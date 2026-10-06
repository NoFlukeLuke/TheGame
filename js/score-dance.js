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
  // A PRIME IS THE SECOND THUMP OF A HEARTBEAT (r296). An ordinary payout waits
  // its turn - a full flight and then tickRest - but a primed Trick firing again
  // is the SAME Trick paying twice, so it lands right behind the beat in front of
  // it and several of them keep that quick pace until the last one has fired.
  // Both are ms/scale at 1x and both ride dncPace() like everything else.
  primeRest:130, primeFlight:0.45,
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
  font: 25.5,                // px, the label
  round: 0, borderW: 0, borderLight: 0, glow: 30,
  ink: '#ffffff',
  // ── The flight itself (r233). These used to be dumped by the preview and read
  // by nobody: dncFly hardcoded its own keyframes, so a tuning session in
  // particle-preview.html could not reach the game. They are live now.
  flightMs: 1440,            // ms at 1x pace
  pop: 1.8,                  // scale at the launch pop
  arc: 0,                    // px of lob; 0 is a straight line
  spin: 30,                  // peak rotation, reached at the HALFWAY point
  spinEnd: -5,               // where it settles by the landing
  landFade: 100,             // % faded out on arrival
  // ── Per-kind overrides. The plate's job is to say WHAT changed before the
  // number is read, so a currency that would be mistaken for another one gets
  // its own shape or its own ink rather than one more shade of the same family.
  shapes: { credits: 'circle' },      // coins are round, because coins are round
  inks:   { time: '#000000' },        // the clock plate is white, so its ink is black
  // ── Ghost trail. A rewind is the one payout that means "this already happened,
  // and it is happening again", so it is the one that gets an after-image: N
  // copies of the plate lagging behind the real one, each fainter than the last.
  trails:    { rewind: 4 },
  trailLag:  0.06,           // share of the flight each successive copy lags by
  trailFade: 0.42,           // opacity of the FIRST ghost; the rest fall off from it
  // ── Blip growth. A long tally is a crescendo: past the first `growStart`
  // particles every further one is `growStep`% bigger than the one before it, so
  // a hand firing forty payouts ends much louder than it started. Compounding,
  // capped at `growMax`. Tunable in the dev panel under Animation.
  // r304 halved `growStep` 5 -> 2.5 (owner's call: the plates were getting too
  // big). The CEILING is untouched - what changed is how fast a hand climbs to
  // it, which is what a realistic hand actually feels: at 40 payouts the last
  // plate was 1.05^35 = x5.5 (clamped to the x3 ceiling) and is now 1.025^35 =
  // x2.37, i.e. under the cap and still visibly building.
  growStart: 5, growStep: 2.5, growMax: 3,
  colors: {
    pipAdd:  '#2f6bd8',      // pips are blue, the PIPS chip's own border colour
    pipMul:  '#0e2a5d',      // a multiply is the same hue, deeper
    multAdd: '#c0202c',      // mult is red, the MULT chip's colour
    multMul: '#6c0f13',
    focus:   '#8a4fd0',
    credits: '#c9a84c',
    time:    '#ffffff',
  },
};
// Per-kind shape / ink / trail, each falling back to the global value.
function ptShape(kind){ const C=PARTICLE_CFG; return (C.shapes && C.shapes[kind]) || C.shape || 'diamond'; }
function ptInk(kind){   const C=PARTICLE_CFG; return (C.inks   && C.inks[kind])   || C.ink   || '#ffffff'; }
function ptTrail(kind){ const C=PARTICLE_CFG; return (C.trails && C.trails[kind]) || 0; }
// Lighten a hex toward white. The border is the plate's own hue brightened, not
// a separate colour, so the diamond reads as one object rather than as an
// outline around a fill.
function _ptLighten(hex, pct){
  const n = parseInt(String(hex).slice(1), 16);
  if (!isFinite(n)) return hex;
  const t = (pct || 0) / 100, m = v => Math.round(v + (255 - v) * t);
  return `rgb(${m(n>>16)},${m((n>>8)&255)},${m(n&255)})`;
}


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
      const t = Math.max(0, Math.min(((now||performance.now()) - start)/dur, 1)), e = 1 - Math.pow(1-t, 3);
      if (scoreEl) scoreEl.textContent = Math.round(fromVal + (toVal-fromVal)*e).toLocaleString();
      if (typeof sfxScoreTick === 'function' && fxRandom() < 0.4) sfxScoreTick();
      if (t < 1) requestAnimationFrame(tk); else { clearTimeout(guard); finish(); }
    })(performance.now());
  });
}

// The one scoring dance. The pre-r89 in-place dance that used to sit behind a
// dev toggle here was removed in r412; playPreviewDance is the whole thing.
async function playScoreDance(result, toRemove, isGoalHand = false) {
  return playPreviewDance(result, toRemove, isGoalHand);
}

function handleDanceAbort(isGoalHand) {
  danceAbortController = null;
  // A LINES round's progress lands now if the climb never finished it.
  if (typeof roundQuotaClimb === 'function') roundQuotaClimb(1);
  // The dance is over, so a takeover screen that opened during it (the mid-dance
  // pick) gets its deferred HUD swap now - BEFORE the goal branch below, so an
  // interlude/prize grid opened from here is never itself deferred. (r310)
  dncGoalLive = false;
  if (typeof applyPendingGridHud === 'function') applyPendingGridHud();
  // dncChain is still not reset here, but the reason has changed: it is derived
  // from the gap between hand SUBMISSIONS now, so an abort with no successor
  // really does self-correct (the next hand is slow, the count restarts), and an
  // abort WITH a successor keeps the depth it earned.
  // An interrupted hand must never leave the PMF row fused - the next hand
  // writes its numbers into chips the player would not be able to see.
  if (typeof pmfResetNow === 'function') pmfResetNow();
  // Same rule for the held hand-type label (r234): this is the hook every abort
  // path already reaches, so releasing here means no abandoned dance can leave
  // the label frozen on a hand that is long gone.
  if (typeof holdHandNameLabel === 'function') holdHandNameLabel(false);
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
    // The round IS won on this path too, and the banner + cleared-clock state
    // only ever fired from the climb's goal-cross tick - which an aborted dance
    // never reaches. Fire it here so a cut-short goal hand still gets QUOTA
    // CLEARED (and a boss win its name: bossWinPending is still set, so
    // flashRoundEnd picks up the kicker before bossSettleWin consumes it).
    if (typeof flashRoundEnd === 'function') flashRoundEnd();
    // A pending boss win settles even on an abort - endBoss clears the timers
    // and opens the prize grid itself, so nothing else here should run.
    if (typeof bossSettleWin === 'function' && bossSettleWin()) { return; }
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
// r310: true while a GOAL hand's dance is in flight. Read by enterGridScreenHud
// (js/shop-grid-preview.js), which defers the location/score-chip swap while it
// is set so the tally stays visible under a mid-dance pick screen. Cleared at
// the dance's normal completion and in handleDanceAbort (the shared abort
// tail), and dncRequestFF applies the pending swap on a skip.
let dncGoalLive = false;
// ── FAST FORWARD (r280) ─────────────────────────────────────────────────────
// The goal hand's animation is the longest thing in the game - a two-second
// jitter, the blast, the fly-in, and then the whole tally - and a player on
// their tenth run has already seen it. `#dnc-ff` is mounted into the hand
// preview for the GOAL HAND ONLY and skips the rest of it.
//
// **IT IS NOT AN ABORT, and that is the whole design.** cancelDance() cuts the
// presentation and leaves handleDanceAbort to pick up the pieces, which for a
// goal hand means the interlude is reached by a different route with the score
// snapped on from outside. This is the SAME dance played at DANCE_CFG.ff: the
// same events in the same order, landing the same numbers, handing off from the
// same line. Nothing downstream can tell the difference.
//
// Two registries, because a speed multiplier alone is not enough - it cannot
// reach a WAAPI animation or a setTimeout that has already been armed:
//   dncFFWaiters - an `await` that should return NOW (raced against its timer)
//   dncFFCuts    - an animation or timer already in flight, to be cut short NOW
// Both are emptied per dance by dncResetFF, so nothing leaks into the next hand.
let dncFFWaiters = [];
let dncFFCuts = [];
function dncResetFF(){ dncFF = false; dncFFWaiters = []; dncFFCuts = []; }
function dncFFSignal(){ return dncFF ? Promise.resolve() : new Promise(res => dncFFWaiters.push(res)); }
// Registering AFTER the button has been pressed runs the cut immediately - that
// is what makes the finale's steps safe to write in order without each one
// having to test dncFF for itself.
function dncFFRegister(fn){ if(dncFF){ try{ fn(); }catch(e){} return; } dncFFCuts.push(fn); }
function dncRequestFF(){
  if(dncFF) return;
  dncFF = true;
  const btn = document.getElementById('dnc-ff'); if(btn) btn.classList.add('ff-on');
  const cuts = dncFFCuts; dncFFCuts = [];
  cuts.forEach(fn => { try{ fn(); }catch(e){} });
  const waits = dncFFWaiters; dncFFWaiters = [];
  waits.forEach(res => { try{ res(); }catch(e){} });
  // A skipped hand is not being watched: bring up any takeover HUD that was
  // waiting for the tally (the mid-dance pick's location swap, r310).
  if (typeof applyPendingGridHud === 'function') applyPendingGridHud();
}
// The button is an absolutely-positioned child of #selected-cards, so it is not
// a row of the dance stage and cannot push the cards around; #selected-cards is
// a positioned element in both orientations (absolute in landscape, relative in
// portrait), so one rule anchors it in both. It is disposed of with everything
// else by the settle's `stage.innerHTML = ''`.
function dncMountFF(stage){
  if(!stage || document.getElementById('dnc-ff')) return;
  const b = document.createElement('button');
  b.id = 'dnc-ff'; b.type = 'button'; b.title = 'Skip the rest of this animation';
  b.innerHTML = '<span class="ff-gl">▶▶</span><span class="ff-lab">SKIP</span>';
  b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); dncRequestFF(); });
  stage.appendChild(b);
}

// ── The goal finale's blast: OUT AND BACK (r280) ────────────────────────────
// The surrounding cards used to fly outward, fade to nothing, and have their DOM
// removed along with the winners. Two things followed from that, and both were
// wrong: the board was EMPTY under the whole tally, and the round-end fall was
// invisible - showLevelUpScreen_fallOnly looks each card up by [data-card-id]
// and skips what it cannot find, so on a goal hand it only ever did the deck
// accounting and never animated a thing.
//
// The cards come home now. The board the round was played on is still under the
// tally, and the fall just before the payout is a real fall again.
//
// The OUT leg is the r150 explosion unchanged - same distance, spin, scale and
// easing - and the return is pickUnexplode's (js/payout-pick.js), which was
// already written as the reverse of exactly this blast. Cards nearest the centre
// leave first and land first, so the board empties outward and fills inward.
const WIN_BLAST_CFG = {
  dist:    200,    // px out along the ray from the board's centre
  distVar: 140,    // extra random distance on top
  spin:    160,    // max degrees at the apex, either way
  scale:   0.82,   // how small it gets at the apex
  fade:    0.10,   // opacity at the apex - deliberately NOT 0, or it pops back in
  // THE TRIP IS TIMED OFF THE TALLY IT PLAYS UNDER (r291). The owner's spec is
  // that the cards take about half as long to come home as the hand takes to
  // score. Both figures below are ms AT 1x and are divided by the pace at the
  // call site, so the whole trip tracks Settings > Motion > Scoring speed.
  // Fitted from measured goal-hand tallies (see the table in CLAUDE.md):
  // tally at 1x is about 6990ms for a 2-card hand and 989ms more per card, so
  // half of it is 2500 + 495 per card.
  dur:     2500,   // ms at 1x: the fixed part of the trip
  perCard:  495,   // ms at 1x: ...plus this for every card in the hand
  outAt:   0.42,   // fraction of dur spent travelling out
  holdAt:  0.50,   // fraction at which the return starts
  stagger: 18,     // ms between cards at 1x, nearest the centre first
  outEase:  'cubic-bezier(.25,.6,.35,1)',
  backEase: 'cubic-bezier(.2,.75,.3,1)',
};
// The live out-and-back animations, so an abort or a fast forward can put every
// card straight back on its cell.
//
// **They are CANCELLED, never left to fill.** The last keyframe IS the resting
// state, so cancelling once the trip is over is seamless - and an animation
// still filling would pin `transform` AND `opacity`, which are the two
// properties the round-end fall then wants to animate itself.
let dncBlast = [];
function dncSettleBlast(){
  dncBlast.forEach(({anim, el}) => {
    try{ anim.cancel(); }catch(e){}
    if(el){ el.style.zIndex=''; el.style.animation=''; }
  });
  dncBlast = [];
}
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
// ══════════════════════════════════════════════
// ONE PARTICLE, ONE FLIGHT (r233)
// ══════════════════════════════════════════════
// The plate builder and the flight keyframes are shared by the scoring dance and
// by the entity payout FX (js/payout-fx.js), so a coin thrown at the credits chip
// is visibly the same object as a pip thrown at the PIPS chip, and one tuning pass
// in particle-preview.html reaches both.

// The base flight length. PARTICLE_CFG.flightMs is the tuned value; DANCE_CFG.pFlight
// is the pre-r233 constant, kept only as the fallback. Read through here by the
// particle AND by the beat's own wait, or a beat banks its subtotal before its
// particles have landed.
function ptBaseFlight(){ return PARTICLE_CFG.flightMs || DANCE_CFG.pFlight; }

// ── Blip growth ────────────────────────────────────────────────────────────
// Past the first `growStart` particles of a hand, every further one is `growStep`%
// bigger than the one before it, compounding to a `growMax` ceiling - so a hand
// firing forty payouts ENDS much louder than it started. Reset per hand by
// dncResetBlips (called from playPreviewDance), exactly as dncResetAccel is for
// pace: each hand winds up from its own base size.
let dncBlipN = 0;
function dncResetBlips(){ dncBlipN = 0; }
function dncBlipScale(){
  const C = PARTICLE_CFG;
  const start = (C.growStart === undefined) ? 5 : C.growStart;
  const step  = ((C.growStep === undefined) ? 5 : C.growStep) / 100;
  const max   = (C.growMax === undefined) ? 3 : C.growMax;
  // 1-INDEXED: `n` is "this is blip number n of the hand", so `growStart` 5 means
  // blips 1-5 are base size and blip 6 is the first one bigger. Counting from 0
  // here gives six base-size blips, which is not what "after the first 5" means.
  const n = ++dncBlipN;
  return Math.min(max, Math.pow(1 + step, Math.max(0, n - start)));
}

// Build one plate. TWO nested elements, deliberately: the OUTER is what the flight
// animates, so the diamond's own 45deg rotation has to live on an inner box or the
// flight's transform would overwrite it every frame. The label counter-rotates.
function ptPlateEl(kind, label, scale, color){
  const C = PARTICLE_CFG, bg = (C.colors && C.colors[kind]) || color || '#d4a857';
  const el = document.createElement('div');
  el.className = 'dnc-particle pt-' + ptShape(kind);
  el.innerHTML = '<span class="pt-box"><span class="pt-lab"></span></span>';
  el.querySelector('.pt-lab').textContent = label;
  el.style.color = color || bg;               // only read by the no-plate shape
  el.style.setProperty('--dnc-pscale', DANCE_CFG.pScale);
  el.style.setProperty('--pt-size', (C.size * DANCE_CFG.pScaleMul * scale) + 'px');
  el.style.setProperty('--pt-font', (C.font * DANCE_CFG.pScaleMul * scale) + 'px');
  el.style.setProperty('--pt-round', C.round + 'px');
  el.style.setProperty('--pt-bw', C.borderW + 'px');
  el.style.setProperty('--pt-bg', bg);
  el.style.setProperty('--pt-bc', _ptLighten(bg, C.borderLight));
  el.style.setProperty('--pt-ink', ptInk(kind));
  el.style.setProperty('--pt-glow', C.glow + 'px');
  return el;
}

// The keyframes. `spin` is the PEAK and is hit at the HALFWAY point, then the plate
// settles back to `spinEnd` on the way down - a flick of the wrist rather than a
// constant tumble.
function ptFrames(dx, dy, scale){
  const C = PARTICLE_CFG, B = 'translate(-50%,-50%)';
  const pop = ((C.pop === undefined) ? 1.2 : C.pop) * scale;
  const arc = C.arc || 0, mid = C.spin || 0;
  const end = (C.spinEnd === undefined) ? 0 : C.spinEnd;
  const fade = (C.landFade === undefined) ? 100 : C.landFade;
  return [
    { transform:`${B} scale(${.5*scale}) rotate(0deg)`, opacity:0 },
    { transform:`${B} translate(${dx*.12}px,${dy*.12 - arc*.5}px) scale(${pop}) rotate(${mid*.5}deg)`, opacity:1, offset:.22 },
    { transform:`${B} translate(${dx*.5}px,${dy*.5 - arc}px) scale(${scale}) rotate(${mid}deg)`, opacity:1, offset:.5 },
    ...[.6,.7,.8,.9].map(o => { const t = (o-.5)/.5;   // fade curve: t^6, almost nothing until the very end
      return { transform:`${B} translate(${dx*(.5+.5*t)}px,${dy*(.5+.5*t) - arc*(1-t)}px) scale(${scale*(1-.2*t)}) rotate(${mid+(end-mid)*t}deg)`, opacity: 1 - fade/100*Math.pow(t,6), offset:o }; }),
    { transform:`${B} translate(${dx}px,${dy}px) scale(${.8*scale}) rotate(${end}deg)`, opacity: 1 - fade/100 },
  ];
}

// Throw a plate (and its ghosts) from rect `a` to rect `b`.
// `opts.animate` / `opts.timeout` let the dance hand in its own pausable versions;
// the payout FX, which runs outside a dance, takes the plain ones.
function ptLaunch(a, b, kind, label, color, dur, opts){
  const o = opts || {}, C = PARTICLE_CFG;
  const anim  = o.animate || ((el, kf, t) => el.animate(kf, t));
  const later = o.timeout || ((fn, ms) => setTimeout(fn, ms));
  const scale = (o.scale === undefined) ? 1 : o.scale;
  const x = a.left + a.width/2,  y = a.top + a.height/2;
  const dx = (b.left + b.width/2) - x, dy = (b.top + b.height/2) - y;
  const frames = ptFrames(dx, dy, scale);
  const tw = { duration: dur, easing:'cubic-bezier(.3,.7,.4,1)', fill:'forwards' };
  // GHOSTS. A rewind is the one payout that means "this already happened, and it
  // is happening again", so it is the one that gets an after-image. Appended
  // FURTHEST-BACK FIRST: these are body-level siblings at one z-index, so DOM
  // order is paint order and the real plate has to go in last to sit on top.
  const trail = (o.trail === undefined) ? ptTrail(kind) : o.trail;
  const lag  = (C.trailLag  === undefined) ? .06 : C.trailLag;
  const fade = (C.trailFade === undefined) ? .42 : C.trailFade;
  for(let i = trail; i >= 1; i--){
    const g = ptPlateEl(kind, label, scale, color);
    g.style.left = x+'px'; g.style.top = y+'px';
    // Opacity carries the fall-off, not the colour: a white plate cannot be
    // lightened any further, and time particles are white plates.
    g.querySelector('.pt-box').style.opacity = (fade * (1 - (i-1)/trail)).toFixed(3);
    document.body.appendChild(g);
    anim(g, frames, Object.assign({}, tw, { delay: dur * lag * i }));
    later(()=>g.remove(), dur * (1 + lag*i) + 60);
  }
  const el = ptPlateEl(kind, label, scale, color);
  el.style.left = x+'px'; el.style.top = y+'px';
  document.body.appendChild(el);
  anim(el, frames, tw);
  later(()=>el.remove(), dur + 60);
  return el;
}

function dncFly(srcEl, boxEl, label, color, onLand, durOverride, kind){
  let a=srcEl?srcEl.getBoundingClientRect():null; const b=boxEl.getBoundingClientRect();
  // BELT AND BRACES FOR THE (0,0) LAUNCH (r304). danceEntityEl now refuses a dead
  // anchor and fireEvent re-resolves at fire time, but THE FALLBACK ANCHOR CAN BE
  // DEAD TOO, and measurement says it routinely is: the goal hand's last card
  // beats land while the interlude is opening, and in portrait that collapses the
  // hand-preview half of the shared strip to 0x0 - so the preview CARD the plate
  // flies from is still in the document and still measures {0,0,0,0}. Every
  // particle in the game passes through here, so this is the one place that can
  // make "flew in from the top-left corner of the screen" impossible.
  //   no origin  -> pop the plate AT its destination rather than across the display
  //   no destination either (the PIPS/MULT chips are display:none on every
  //     grid-takeover screen) -> draw nothing at all. There is nothing on screen
  //     left for it to mean, and a plate in the corner is worse than no plate.
  // THE ARITHMETIC IS UNTOUCHED EITHER WAY: the accel still bumps and the promise
  // still resolves after `dur`, because r220's rule is that replaying the timeline
  // has to reproduce calcScore exactly - what may vary is only what is drawn.
  const liveB = b.width > 0 && b.height > 0;
  if(!a || !a.width || !a.height) a = b;
  const base = ptBaseFlight();
  const dur = durOverride || (dncFF ? Math.max(60, base/DANCE_CFG.ff) : Math.max(60, base/dncPace()));
  // The blip counter advances whether or not a plate is drawn, so a skipped one
  // does not shrink the next visible plate back down the growth curve.
  const _blip = dncBlipScale();
  if(liveB) ptLaunch(a, b, kind, label, color, dur,
    { scale: _blip, animate: dncAnimate, timeout: dncTimeout });
  // This particle IS a payout tick - a card's pips, a Trick's pips or mult, a
  // Sleight firing. Bump AFTER dur is read so the speed-up lands on what is
  // still to come, not on the flight that earned it.
  dncBumpAccel();
  return new Promise(res=>dncTimeout(()=>{ if(onLand) onLand(); res(); }, dur));
}
function dncFinishAbort(stage, isGoalHand, myGen){
  // If a newer dance has taken over (myGen behind the global), this dance was superseded:
  // do NOT touch the shared stage/score UI - the successor owns it now.
  if(myGen!==undefined && myGen!==dncGen) return;
  if(typeof holdHandNameLabel==='function') holdHandNameLabel(false);
  if(stage){ stage.classList.remove('dnc-active'); stage.innerHTML=''; } dncCleanupReal(); dncSettleBlast(); dncRestoreHiddenGridEls(); handleDanceAbort(isGoalHand); }
// Display name for a contribution entity, by source (Trick / Sleight / Knack).
function contribLabel(source, id){
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
// AN ANCHOR IS ONLY AN ANCHOR IF IT HAS A REAL RECT (r304). The same rule
// js/payout-fx.js and tutEl() already follow, and the one this file was missing:
// a detached or hidden element measures {0,0,0,0}, and dncFly takes the CENTRE of
// that rect, so the particle launches from the top-left CORNER OF THE SCREEN
// rather than from the thing that paid it. Returning null here instead sends the
// caller to its fallback anchor (the card that triggered it, or the chip it flies
// into), which is always somewhere the player is already looking.
function dncUsable(el){
  if(!el || !el.isConnected) return null;
  const b = el.getBoundingClientRect();
  return (b.width > 0 && b.height > 0) ? el : null;
}
function danceEntityEl(source, id){
  if(source==='trick'){
    const chip=dncUsable(document.querySelector(`.trick-tray-chip[data-trick-id="${CSS.escape(id)}"]`));
    if(chip) return chip;
  } else if(source==='knack'){
    const k=dncUsable(document.querySelector(`.knack-chip[data-knack-id="${CSS.escape(id)}"]`)); if(k) return k;
  } else if(source==='sleight'){
    for(let r=0;r<gridRows;r++)for(let c=0;c<gridCols;c++){ const cell=gridData[r]?.[c];
      if(cell?._isSleight && cell.sleightId===id) return dncUsable(document.querySelector(`#grid [data-card-id="${cell._id}"]`)); }
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
// THE FLYING COPY (r503). One rule keeps the copy honest: everything that marks a
// card (buffs, curses, charges, states, rarity edge) is drawn INSIDE the card
// element, by renderCardAppearance, as a child or a class. So a deep clone carries
// every mark there is, and the preview slot (built by the same function) lands on
// an identical card. A mark drawn as a separate layer on #grid would not fly; put
// new marks in renderCardAppearance. This strips only what belongs to the board
// moment, not the card: selection and hint states, the order badge, the animation
// lab's own overlays and idle classes, and inline styles (cell position, gaze tilt).
const CARD_FLY_STRIP = /^(selected|hand-|swap-pending|unreachable|score-pop|dnc-|ca-|flowr-|tray-|sqp-|sq-|m3-)/;
function cardFlyClone(gEl){
  const c = gEl.cloneNode(true);
  [...c.classList].forEach(k => { if (CARD_FLY_STRIP.test(k)) c.classList.remove(k); });
  c.removeAttribute('data-card-id');
  c.querySelectorAll('.sel-num, [class^="ca-"]').forEach(n => n.remove());
  return c;
}
// Fly a clone of a selected grid card into its preview slot, then reveal the slot's dnc-card.
function flyGridCardToSlot(gEl, slotEl, dur, idx, lookId){
  if(!slotEl) return;
  const reveal=()=>{ slotEl.style.opacity=''; slotEl.animate([{transform:'scale(.82)'},{transform:'scale(1)'}],{duration:150,easing:'ease-out'}); };
  const s = gEl && gEl.getBoundingClientRect();
  const t = slotEl.getBoundingClientRect();
  // dur 0 = there is no flight to watch, just put the card in its slot. That is
  // what a fast forward asks for, and it is the same path a zero-size anchor
  // already took.
  if(!dur || !s || !s.width || !t.width){ reveal(); return; }
  const clone = cardFlyClone(gEl);
  const _zTop = slotEl.closest && slotEl.closest('#ca-lab') ? 5001 : 250;   // the card animation lab sits above the game
  // The copy lives on body, outside #cabinet's zoom, but its text and marks are
  // sized in design px. So it is drawn at the board's own zoom (z): design-px box,
  // and every length (position, flight, size) divided by z. Without this the card
  // flew at full size with its text at 1/z (half size on a desktop).
  const ow = gEl.offsetWidth || s.width, oh = gEl.offsetHeight || s.height, z = s.width / ow || 1;
  clone.style.cssText = `position:fixed;margin:0;z-index:${_zTop};pointer-events:none;transition:none;zoom:${z};left:${s.left/z}px;top:${s.top/z}px;width:${ow}px;height:${oh}px;transform-origin:center center;`;
  document.body.appendChild(clone);
  gEl.style.opacity='0'; dncHiddenGridEls.push(gEl); // hide the original while its clone flies (restored on abort)
  const dx=((t.left+t.width/2)-(s.left+s.width/2))/z, dy=((t.top+t.height/2)-(s.top+s.height/2))/z;
  // A Sleight stands up in the preview (.dnc-turn, css/dance.css): it turns a
  // quarter and grows as it flies, landing on its slot card's own rotate and scale.
  const side = slotEl.classList.contains('dnc-turn');
  const sc=t.width/s.width;
  // r437: the flight's shape is the chosen look (dev -> Card Animations, js/card-anims.js).
  // Every look keeps this duration, because the dance times its beats to it.
  const look = cardFlyLook(dx, dy, sc, idx||0, oh, lookId);
  // The turn goes on the END of each frame's transform, after the flight's
  // translate, so the path is not turned with the card (a standalone rotate would be).
  const _tEl = side && slotEl.firstElementChild, _ts = _tEl && getComputedStyle(_tEl);
  if (_ts) {
    const rot = parseFloat(_ts.rotate) || 0, k = parseFloat(_ts.scale) || 1, n = look.frames.length;
    look.frames = look.frames.map((f, i) => { const o = f.offset ?? (n > 1 ? i / (n - 1) : 1);
      return Object.assign({}, f, { transform: `${f.transform} rotate(${rot * o}deg) scale(${1 + (k - 1) * o})` }); });
  }
  const ghosts = [];
  for (let g = 1; g <= (look.ghosts||0); g++) {
    const gh = clone.cloneNode(true); gh.style.zIndex = _zTop - 1; gh.style.opacity = 0;
    document.body.insertBefore(gh, clone); ghosts.push(gh);
    gh.animate(look.frames.map(f => Object.assign({}, f, { opacity: (f.opacity ?? 1) * (0.42 / g) })),
      { duration: dur, delay: g * 34, easing: look.easing, fill: 'both' });
  }
  const done=()=>{ if(clone.parentNode) clone.remove(); ghosts.forEach(g=>g.remove()); reveal(); };
  const anim=clone.animate(look.frames, {duration:dur, easing:look.easing, fill:'forwards'});
  anim.onfinish=done; setTimeout(done, dur+140);
  // A clone already in the air cannot be reached by a speed multiplier, so it
  // registers its own cut: land it where it was going and reveal the slot.
  if(typeof dncFFRegister==='function') dncFFRegister(()=>{ try{ anim.finish(); }catch(e){} done(); });
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
  dncGoalLive = isGoalHand;   // holds the grid-screen HUD swap back while the tally plays (r310)
  dncResetFF(); dncSettleBlast(); resetParticleStep();
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
  dncResetBlips();          // ...and from its own base particle size
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
  const targetFocusExtra = lastCalcFocusExtra || 0; // extra applications (Phoenix / Kaleidoscope, r343) - captured NOW, the global is overwritten by speculative calcScores
  const _fmtFocus = f => '×' + (f % 1 === 0 ? f : f.toFixed(2).replace(/0$/, ''));
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
  // r399: playHand banks the ledger it scored with; re-scoring here ran after the
  // streak/run/hand counters had already advanced and animated the wrong hand.
  let contrib, _ledger;
  if (result && result._bankLedger && result._bankContrib) { contrib = result._bankContrib; _ledger = result._bankLedger; }
  else { const savedPFM = lastPreFocusMult; contrib=[]; _ledger={}; calcScore(hand, handCells, contrib, _ledger); lastPreFocusMult = savedPFM; }
  const timeline = _ledger.timeline || [];
  const fmtM = m => (m%1===0)?m:m.toFixed(1);
  // Cells in SCORING order (the timeline's card indices point here, and scoring
  // order is not selection order once the Selection Scoring knack is owned).
  const scoreCells = (typeof scoringOrderCells === 'function') ? scoringOrderCells(handCells) : handCells.slice();
  const repsByCard = (_ledger.cards||[]).map(c=>c.reps||1);
  // r234: THE PREVIEW IS LAID OUT IN SCORING ORDER, not selection order.
  //
  // It used to be built from handCells (the order you tapped) while the tally
  // walked scoreCells (row-major, reading order), so the beats hopped about the
  // strip and a hand read as scoring in no order at all. Laying the strip out in
  // scoring order makes the tally run left to right, and it answers BOTH halves
  // of the ask for free: scoringOrderCells returns selection order when the
  // Selection Scoring knack is owned, so on that loadout the strip is in the
  // order the cards were picked - which is exactly the order they then score in.
  //
  // With the two lists in step, a timeline card index IS its slot index.
  const previewCells = scoreCells;
  const slotOf = si => si;

  // Walk the timeline into STEPS: one per card (replayed `reps` times) and one per
  // hand-level event. This is the running order of the whole tally.
  const steps = [];
  for(let i=0;i<timeline.length;){
    const ev = timeline[i];
    if(ev.card >= 0){ const ci=ev.card, start=i;
      while(i<timeline.length && timeline[i].card===ci) i++;
      steps.push({ kind:'card', card:ci, slot:slotOf(ci), reps:repsByCard[ci]||1, events:timeline.slice(start,i) });
    } else { steps.push({ kind:'hand', event:ev, prime: !!ev.prime }); i++; }
  }
  // Every entity that will fire. Nothing is charged here - an entity stays
  // perfectly still until its own event lands.
  //
  // THE SNAPSHOT IS A CACHE, NOT THE ANSWER (r304). It used to be resolved once
  // here and read straight out at fire time, and a tray chip does not survive the
  // hand: `renderTrickTray()` rebuilds `#trick-tray-list`'s children wholesale and
  // is called DURING a hand by the cooldown/prime bookkeeping in play-hand.js and
  // scoring.js, by boss-effects, by card-states and by hallmark. The element
  // cached up here is then detached, `getBoundingClientRect()` reads {0,0,0,0},
  // and every Trick particle for the rest of that hand flew from the TOP-LEFT
  // CORNER OF THE SCREEN - measured, both orientations, from the first entity
  // payout of the hand onward. It is far more obvious in portrait, where the tray
  // is at the bottom of the screen, which is why it reads as a mobile bug.
  //
  // Chasing the call sites would not fix it - the tray is entitled to repaint
  // mid-hand. So `dncEntEl` re-queries whenever what it holds is no longer usable,
  // and that also puts the charge/pop back on the live chip, which had been
  // styling a detached node for just as long.
  const elById = {};
  const entityEls = [];
  const dncEntEl = ev => {
    if(!ev || ev.id === '_card') return null;
    const cached = dncUsable(elById[ev.id]);
    if(cached) return cached;
    const el = danceEntityEl(ev.source, ev.id);
    elById[ev.id] = el || null;
    // Cleanup (dncRealEls / the jitter sweep below) has to know about the element
    // that actually got the class, not the one that was here when the hand began.
    if(el && !entityEls.includes(el)){ entityEls.push(el); dncRealEls.push(el); }
    return el;
  };
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
  // Freeze the hand-type label for the length of the tally (r234). render() runs
  // several times below with the selection already cleared, and each one would
  // otherwise blank it.
  // Stamp THIS hand's name on first: a hand submitted while the previous tally was still
  // running inherits that tally's hold, and with it the previous hand's label (r401).
  if(typeof updateHandNameLabel==='function') updateHandNameLabel(result, true);
  if(typeof holdHandNameLabel==='function') holdHandNameLabel(true);
  const stage=document.getElementById('selected-cards'); stage.classList.add('dnc-active'); stage.innerHTML='';
  const mkRow=(label,extra)=>{ const row=document.createElement('div'); row.className='dnc-row'+(extra?(' '+extra):'');
    const l=document.createElement('div'); l.className='dnc-lab'; l.textContent=label;
    const items=document.createElement('div'); items.className='dnc-items';
    row.appendChild(l); row.appendChild(items); stage.appendChild(row); return items; };
  const handItems=mkRow('','hand');   // no caption (r333) - the hand-name chip beside the cards is the label now
  const handTrack=document.createElement('div'); handTrack.className='dnc-track'; handItems.appendChild(handTrack);
  // Reuse the SAME grid-accurate markup the hand preview uses (renderCardAppearance), so cards
  // don't visually change when the dance starts (and the fly-in clone lands as an identical card).
  // Wrapped in .dnc-outer for the two-layer activation animation; sized by #selected-cards'
  // --card-w/--card-h; appended into the .dnc-track so large hands can scroll sideways as they score.
  const cardEls=previewCells.map(([r,c])=>{ const card=gridData[r][c];
    const outer=document.createElement('div'); outer.className='dnc-outer'+(card._isSleight?' dnc-turn':'');   // r503: a Sleight stands up (css/dance.css)
    const d=document.createElement('div');
    const { className, innerHTML } = renderCardAppearance(card, r, c, { revealFog: true });
    d.className=className+' preview-card'; d.innerHTML=innerHTML;
    outer.appendChild(d); handTrack.appendChild(outer); return d; });
  // Portrait sizes its preview cards to the strip, and overlaps them if the hand
  // is too wide to fit. Must run BEFORE the fly-in - flyGridCardToSlot measures
  // each slot's rect to land the clone on it.
  if (typeof fitPortraitPreviewCards === 'function') fitPortraitPreviewCards();
  dncRealEls = entityEls.slice();
  // The goal hand gets a SKIP in the preview, live from the first frame of the
  // jitter (r280). Only the goal hand: it is the one animation long enough to be
  // worth skipping, and the one that ends the round.
  if(isGoalHand) dncMountFF(stage);
  // Settings -> Skip (r380). The SAME dance at the skip speed - dncRequestFF is
  // the goal hand's own SKIP, which lands the same numbers in the same order.
  if (typeof skipOn === 'function' && (skipOn('scoring') || (isGoalHand && skipOn('finale')))) dncRequestFF();

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
    await Promise.race([wait(2000), dncFFSignal()]);
    if(aborted()){ dncFinishAbort(stage,isGoalHand,myGen); return; }
    jitters.forEach(a=>{ try{ a.cancel(); }catch(e){} });
    // 2) Surrounding cards BLAST OUT AND COME BACK (r280 - see WIN_BLAST_CFG).
    //    Out along the ray from the board's centre, a beat at the apex, then
    //    home to the cell they left. Nearest the centre goes first and lands
    //    first, so the board empties outward and fills back inward.
    //    A fast forward taken during the jitter skips the blast outright rather
    //    than starting one and cancelling it a frame later.
    if(!dncFF){
      sfxWinExplode();
      const C = WIN_BLAST_CFG;
      // dncPace() IS the Scoring speed setting at this point, which is why the
      // trip can track the slider without reading it: the accel only bumps on
      // payout ticks (dncBumpAccel has ONE call site, in the particle launcher)
      // and every one of those is in the tally, which has not started yet.
      // The stagger scales with it too - left flat it would dominate the trip
      // at high speeds instead of merely sequencing it.
      const bPace = dncPace() || 1;
      const bStag = C.stagger / bPace;
      let   bDur  = (C.dur + C.perCard * handCells.length) / bPace;
      // SURVIVAL AND FLOW OPEN THE PICK THE MOMENT THE FLY-IN LANDS (r385), and
      // the pick takes #grid over - so a card still on its way home is wiped off
      // the board mid-flight. Owner: "the cards start their return post explosion
      // but they get cut off by the options coming into view. speed up the return
      // so it can finish before the options come up." The whole trip, stagger
      // included, is squeezed inside the fly-in's own wait (the await below).
      if(survivalActive() && (!(typeof bossWinPending!=='undefined' && bossWinPending)
          || (typeof flowBossWinTakesChain==='function' && flowBossWinTakesChain()))){
        const flyWait = 140 + previewCells.length*100 + 460 + 220;   // GF_LEAD + n*GF_STEP + GF_DUR + 220
        const fit = flyWait - 60 - Math.max(0, loseEls.length-1) * bStag;
        bDur = Math.max(420, Math.min(bDur, fit));
      }
      const gr = gridEl.getBoundingClientRect(); const cx=gr.left+gr.width/2, cy=gr.top+gr.height/2;
      dncBlast = loseEls.map(el => {
        const r=el.getBoundingClientRect(); let ax=(r.left+r.width/2)-cx, ay=(r.top+r.height/2)-cy;
        const len=Math.hypot(ax,ay)||1;
        return { el, ax:ax/len, ay:ay/len, d:len };
      }).sort((a,b)=>a.d-b.d).map((row,i) => {
        const dist=C.dist+fxRandom()*C.distVar, rot=(fxRandom()*2-1)*C.spin;
        const out=`translate(${row.ax*dist}px,${row.ay*dist}px) rotate(${rot}deg) scale(${C.scale})`;
        const home='translate(0,0) rotate(0) scale(1)';
        row.el.style.zIndex='30';
        return { el: row.el, anim: row.el.animate([
          { transform:home, opacity:1,      offset:0,        easing:C.outEase },
          { transform:out,  opacity:C.fade, offset:C.outAt,  easing:'linear' },
          { transform:out,  opacity:C.fade, offset:C.holdAt, easing:C.backEase },
          { transform:home, opacity:1,      offset:1 },
        ], { duration:bDur, delay:i*bStag, fill:'both' }) };
      });
      // The blast outlives the await below at ordinary speeds (the tally starts
      // while the last cards are still coming home, which is the intent), so the
      // release is hung off the animations themselves rather than off the step.
      // A cancelled animation REJECTS `finished`, hence the catch - that is the
      // fast-forward path arriving here.
      const _blast = dncBlast;
      Promise.all(_blast.map(b => b.anim.finished.catch(()=>{}))).then(()=>{ if(dncBlast===_blast) dncSettleBlast(); });
      dncFFRegister(dncSettleBlast);
    }
    // 3) As the blast happens, the winning cards fly up into the preview slots
    //    (reveals each slot's dnc-card, same handoff normal hands use).
    const GF_LEAD=140, GF_STEP=100, GF_DUR=(typeof cardFlyMs==='function' ? cardFlyMs(460) : 460);   // r468: the fly look may take longer
    const flyQueue=[];
    previewCells.forEach(([r,c],i)=>{ const card=gridData[r]?.[c]; if(!card) return;
      const gEl=gridEl?.querySelector(`[data-card-id="${card._id}"]`);
      const slot=cardEls[i].parentElement;
      const go = dur => { if(aborted()) return; flyGridCardToSlot(gEl, slot, dur, i); };
      if(dncFF){ go(0); return; }                       // already skipping: straight into the slot
      const entry={ go };
      entry.t=setTimeout(()=>{ const k=flyQueue.indexOf(entry); if(k>=0) flyQueue.splice(k,1); go(GF_DUR); }, GF_LEAD + i*GF_STEP);
      flyQueue.push(entry);
    });
    // A fast forward flushes whatever has not left the board yet; a clone already
    // in the air is cut short by flyGridCardToSlot's own registered cut.
    dncFFRegister(()=>{ flyQueue.splice(0).forEach(e=>{ clearTimeout(e.t); e.go(0); }); });
    await Promise.race([wait(GF_LEAD + previewCells.length*GF_STEP + GF_DUR + 220), dncFFSignal()]);
    if(aborted()){ dncFinishAbort(stage,isGoalHand,myGen); return; }
    // Only the WINNERS leave the board - they are in the preview now. The rest of
    // the board stays exactly where it is, under the tally, and goes out in the
    // round-end fall (showLevelUpScreen_fallOnly), which is also where the deck
    // accounting for every card - winners included - still happens.
    //
    // That is why clearLineMarkers() is NOT called here any more: the marked
    // row/column lines belong to a board that has not left yet. The fall drops
    // them at the same moment it drops the cards.
    winEls.forEach(el => el.remove()); dncHiddenGridEls=[];
    // `animation:'none'` was written inline on every card above to kill a
    // lingering score-pop. dncSettleBlast takes it back off the cards it
    // animated, but a fast forward taken during the jitter means there was no
    // blast to settle - so the cards that stay on the board get it cleared here
    // too, or their own CSS animations are dead for the rest of the round.
    loseEls.forEach(el => { el.style.animation=''; });
    // Survival: open the pick-of-three NOW (right of the preview), so the score
    // count-up below runs alongside it - the player can watch the tally or start
    // picking a bonus. (In survival the deck accounting happens in survivalDealNext.)
    // (Not on a boss win - that hand ends in the PRIZE grid via bossSettleWin,
    // and a pick opened here would fight it for the screen.)
    // FLOW's boss win (r409) takes this same beat: the boss settles here and its
    // reward chain (celebration -> count -> prize grid first) plays where a goal
    // clear's would, so the order of the animation is the ordinary one.
    const _flowBossChain = typeof flowBossWinTakesChain==='function' && flowBossWinTakesChain();
    if(survivalActive() && (_flowBossChain || !(typeof bossWinPending!=='undefined' && bossWinPending))){
      if(_flowBossChain) bossSettleWinFlow();
      else survivalShowPick();
      // THE TALLY WAITS FOR THE CHAIN'S COUNTER (r376). Owner: "the cards
      // should explode out and fly to the preview, then BEFORE they start to
      // dance, the level up thing appears and quite loudly does its animation.
      // Then the card preview can resume once the options start appearing."
      // flowrIntroWait() is null unless a multi-reward chain is arming, so the
      // ordinary pick-of-three path awaits nothing and is byte-identical.
      if(typeof flowrIntroWait==='function'){
        const _intro = flowrIntroWait();
        if(_intro){
          await Promise.race([_intro, dncFFSignal()]);
          if(aborted()){ dncFinishAbort(stage,isGoalHand,myGen); return; }
        }
      }
    }
  } else if(skipBeats){
    // ── Third hand of a burst: no fly-in. The cards leave the board immediately
    //    and the preview keeps whatever it already shows; the only thing this
    //    hand still owes the player is its fuse and its throw at the score. ──
    cardEls.forEach(d=>{ const o=d.parentElement; if(o) o.style.opacity=''; });
    if(typeof sfxFlipShuffle==='function') sfxFlipShuffle();
    removeAndFall(toRemove,'play'); dncHiddenGridEls=[];
  } else {
    // ── Normal hand: the selected grid cards physically fly into their preview slots. ──
    const FLY_STAGGER=95/dncPace(), FLY_DUR=(typeof cardFlyMs==='function' ? cardFlyMs(400) : 400)/dncPaceNoFocus();   // r491: cardFlyMs already holds Focus   // r468: the fly look may take longer
    cardEls.forEach(d=>{ const o=d.parentElement; if(o) o.style.opacity='0'; });
    previewCells.forEach(([r,c],i)=>{ const card=gridData[r][c]; if(!card) return;
      const gEl=gridEl?.querySelector(`[data-card-id="${card._id}"]`);
      const slot=cardEls[i].parentElement;
      setTimeout(()=>{ if(aborted()) return; flyGridCardToSlot(gEl, slot, FLY_DUR, i); if(typeof sfxCardPop==='function') sfxCardPop(cardColorSuit(card)); }, i*FLY_STAGGER);
    });
    await wait(previewCells.length*FLY_STAGGER + FLY_DUR);
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
    // The multiplier applied AGAIN (Phoenix / Kaleidoscope, r343): a second, quicker
    // thump right behind the first - the prime's heartbeat idea - with the focus
    // sound doubled, one per extra application.
    for (let _fk = 0; _fk < targetFocusExtra; _fk++) {
      await dwait(200); if(aborted()){ dncFinishAbort(stage,isGoalHand,myGen); return; }
      const fb2=document.getElementById('focus-box'); if(fb2){ fb2.classList.remove('focus-beat'); void fb2.offsetWidth; fb2.classList.add('focus-beat'); }
      if(typeof sfxFocusBeat==='function') sfxFocusBeat();
    }
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

  // THE REST AFTER A STEP IS DECIDED BY THE STEP THAT FOLLOWS IT (r296), because
  // the walk is written "fire, then rest" - so the only way to land a prime right
  // behind the beat in front of it is to cut the rest that beat was about to take.
  // Consecutive primes each shorten the gap before them, and the first ordinary
  // step after the run takes a full tickRest, which is the pace resuming.
  const restAfter = si => (steps[si+1] && steps[si+1].prime) ? DANCE_CFG.primeRest : DANCE_CFG.tickRest;
  // A prime's own flight is shortened to match. dncFly computes its own duration
  // when handed none, so an override has to divide by the pace itself.
  const primeFlight = () => Math.max(60, ptBaseFlight() * DANCE_CFG.primeFlight / (dncFF ? DANCE_CFG.ff : dncPace()));

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
    const el = dncEntEl(ev);
    if(el) dncReleaseReal(el);
    const src = el || fallbackEl;
    const box = (ev.op==='pip+'||ev.op==='pip*') ? pipsBox : multBox;
    const land = () => {
      if(ev.op==='pip+'){ if(inBeat) subRef.v += ev.value; else rp += ev.value; showPips(subRef.v); }
      // A card's x pips (r461) multiplies the whole running total: bank the beat so far, then multiply.
      else if(ev.op==='pip*' && ev.scope==='total'){ rp = _rnd((rp + subRef.v)*ev.value, ev.rnd); subRef.v = 0; showPips(0); }
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
      await fireEvent(ev, anchor, { v:0 }, true, false, step.prime ? primeFlight() : undefined);
      await dwait(restAfter(si));
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
      const beatDur = dncFF ? Math.max(60, ptBaseFlight()/DANCE_CFG.ff)
                            : Math.max(60, ptBaseFlight()/dncPace());
      // `once` events pay per CARD, not per scoring iteration (the per-card payer
      // table in calcScore - Get Even and friends read `cells.length`, not a
      // replay-weighted count). So a replayed card re-pops and re-fires
      // everything else, but not those, or the chip drifts above the real total.
      // `vals` (Hard Labour, r461): an event worth a different amount on each replay.
      const beatEvents = (rep === 0 ? step.events : step.events.filter(ev => !ev.once))
        .map(ev => ev.vals ? Object.assign({}, ev, { value: ev.vals[rep] }) : ev);
      const applies = beatEvents.map(ev => fireEvent(ev, cardEl, subRef, false, true, beatDur, true));
      await dncWait(beatDur);
      if(aborted()){ dncFinishAbort(stage,isGoalHand,myGen); return; }
      applies.forEach(fn => { if(fn) fn(); });
      // The card's pips join the hand total once its own beat has resolved, so a
      // card-scoped multiply has something of its own to multiply.
      rp += subRef.v; showPips(0);
      // Only the LAST rep's rest is the gap before the next step - the earlier
      // ones separate a card from its own replay and always run at full pace.
      await dwait(rep === step.reps - 1 ? restAfter(si) : DANCE_CFG.tickRest);
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
      // A frame's timestamp can be a little EARLIER than `st` (it is the frame's start),
      // and a negative tt made the cubic dip the number below the old score.
      const tt=Math.max(0,Math.min((now-st)/climb,1)), e=1-Math.pow(1-tt,3);
      const cur=Math.round(scoreBefore+(scoreAfter-scoreBefore)*e);
      if(scoreEl) scoreEl.textContent=cur.toLocaleString();
      if(typeof roundQuotaClimb==='function') roundQuotaClimb(e);   // LINES fill with the tally (js/level-types.js)
      if(isGoalHand && !goalFlashed && (roundQuota ? tt>=1 : cur>=roundGoal)){ goalFlashed=true; if(typeof flashRoundEnd==='function') flashRoundEnd(); }
      if(typeof sfxScoreTick==='function' && fxRandom()<0.35) sfxScoreTick();
      if(tt<1) requestAnimationFrame(tk); else res(); }
    requestAnimationFrame(tk); });
  if(aborted()){ dncFinishAbort(stage,isGoalHand,myGen); return; }

  // ── PMF split ── the hand is banked; hand the row back as three chips.
  if(typeof pmfSplitOut==='function') await pmfSplitOut({ speed: dncFF ? DANCE_CFG.ff : dncPace() });
  if(aborted()){ dncFinishAbort(stage,isGoalHand,myGen); return; }

  // ── Settle (same tail as playScoreDance) ──
  if(typeof holdHandNameLabel==='function') holdHandNameLabel(false);
  stage.classList.remove('dnc-active'); stage.innerHTML=''; dncCleanupReal();
  if(scoreEl) scoreEl.textContent=scoreAfter.toLocaleString();
  showComboFloats(hand, handCells, result);
  const scoreBoxEl=document.getElementById('score-mid');
  if(scoreBoxEl){ scoreBoxEl.classList.remove('box-popping'); void scoreBoxEl.offsetWidth; scoreBoxEl.classList.add('box-popping'); }
  await wait(300/(dncFF ? DANCE_CFG.ff : dncPace())); if(aborted()){ dncFinishAbort(stage,isGoalHand,myGen); return; }

  danceAbortController = null;
  dncChain = 0; _dncOutHandScore = 0;   // the burst has landed
  // Normal completion (the abort paths go through handleDanceAbort) - give the
  // portrait strip back to whichever half the player had chosen.
  if (typeof portraitDanceEnd === 'function') portraitDanceEnd();
  if(pipsEl) pipsEl.textContent='0'; if(multEl) multEl.textContent='0';
  if(isGoalHand){ if(score>highestHandScore) highestHandScore=score; if(pendingLevelUps>0) sfxMultiGoal(pendingLevelUps); }
  updateScoreUI();
  // The tally has landed on the real score, so the deferred takeover HUD (the
  // mid-dance pick's location swap) may come up now - and it MUST be released
  // before the handoff below, so an interlude or prize grid opened from here
  // gets its own swap applied rather than deferred. (r310)
  dncGoalLive = false;
  if (typeof applyPendingGridHud === 'function') applyPendingGridHud();

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
      // A pending boss win takes the handoff first (endBoss opens the prize
      // grid itself); Survival opened its pick during the fly (above); everyone
      // else hands off to the standard interlude/payout.
      if(typeof bossSettleWin==='function' && bossSettleWin()){ /* endBoss routed it */ }
      else if(!survivalActive()) startInterlude();
    }
  }
}

// ══════════════════════════════════════════════
// DISCARD
// ══════════════════════════════════════════════
