// ══════════════════════════════════════════════
// SCORE BLAST (r691, owner) - js/score-dance.js plays it
// ══════════════════════════════════════════════
// Two moments used to FAST-FORWARD a hand's tally to an illegible speed: the hands
// in front of a winning hand played over the queue (r670), and a deep scoring queue
// (r661, x4 and up). Owner: "rather than speeding through the animation, just have
// the hand jitter and explode out in violent fashion and play a slightly unique
// sound". So a hand whose card beats are cut now BLASTS: its cards shake harder and
// harder, the look's own beats land the PIPS and MULT chips on their totals, and the
// cards blow out of the preview. Then the hand fuses, throws and climbs as usual.
//
// Looks (dev -> Aesthetics -> Blast scoring; the store holds a non-default choice):
//   beats5    five rapid beats alternating PIPS / MULT, each a plate and a tone up
//   shockwave a wind-up, then one slam: a ring from the preview, both chips at once
//   strobe    the cards flash in sweeps that speed up; the chips flicker and lock
//   implode   the cards are pulled into one point, hold, and burst
//   drumroll  a dozen small plates rattle onto the chips, faster and faster, then a crash
//   off       the old fast forward
// scoreBlast(ctx) is the one entry; scoreBlast.on() says whether a cut hand blasts.
const BLAST_KEY = 'lethe.scoreBlast.v1';
//   overload  the preview screen fails: the picture tears and rolls with static, the figures
//             burn in through the noise, the picture snaps back with the cards gone
//   reels     PIPS and MULT spin like slot reels after a lever clunk, land one at a time
//             on a bell; the cards are flung on the second bell
const BLAST_LOOKS = { beats5: 'Five beats', shockwave: 'Shockwave', strobe: 'Strobe', implode: 'Implode', drumroll: 'Drumroll', overload: 'Overload', reels: 'Reels', off: 'Off (fast forward)' };
const BLAST_DEFAULT = 'beats5';
const BLAST_QUEUE_DEEP = 3;   // hands waiting (the fourth hand in the system) makes the live hand blast
let blastLook = (() => { try { const v = localStorage.getItem(BLAST_KEY); return BLAST_LOOKS[v] ? v : BLAST_DEFAULT; } catch (e) { return BLAST_DEFAULT; } })();
function setBlastLook(v) {
  if (!BLAST_LOOKS[v]) return;
  blastLook = v;
  try { v === BLAST_DEFAULT ? localStorage.removeItem(BLAST_KEY) : localStorage.setItem(BLAST_KEY, v); } catch (e) {}
  const sel = document.getElementById('dev-blast-look'); if (sel) sel.value = v;
}
function blastOn() {
  return blastLook !== 'off' && !document.body.classList.contains('reduced-motion')
    && !(typeof skipOn === 'function' && skipOn('scoring'));
}
// Read by the dance's walk: four or more hands in the system cut the live hand's beats.
function blastQueueDeep() { return blastOn() && typeof dncQueue !== 'undefined' && dncQueue.length >= BLAST_QUEUE_DEEP; }

// ── helpers ──────────────────────────────────────────────────────────────────
const blWait = (ms, sig) => new Promise(r => { const t = setTimeout(r, ms); if (sig) sig.addEventListener('abort', () => { clearTimeout(t); r(); }, { once: true }); });
const blAnim = (el, frames, opts) => new Promise(res => {
  if (!el || !el.animate) return res();
  const a = el.animate(frames, opts); a.onfinish = () => res(a); a.oncancel = () => res(a);
});
const BL_PIP = '#d4a857', BL_MULT = '#b07dea';
const blFmtM = m => (m % 1 === 0) ? m : (Math.round(m * 10) / 10).toFixed(1);
// The shake: a WAAPI jitter of `mag` px on the card's `translate`, replaced as it grows.
function blShake(cards, mag, ms) {
  cards.forEach(el => {
    const o = el.parentElement || el;
    if (o._blShake) { try { o._blShake.cancel(); } catch (e) {} }
    const kf = []; for (let i = 0; i < 8; i++) kf.push({ translate: `${((fxRandom() - .5) * 2 * mag).toFixed(1)}px ${((fxRandom() - .5) * 2 * mag).toFixed(1)}px`, rotate: `${((fxRandom() - .5) * mag * 1.2).toFixed(1)}deg` });
    kf.push(kf[0]);
    o._blShake = o.animate(kf, { duration: ms || 110, iterations: Infinity, easing: 'linear' });
  });
}
function blShakeStop(cards) { cards.forEach(el => { const o = el.parentElement || el; if (o._blShake) { try { o._blShake.cancel(); } catch (e) {} o._blShake = null; } }); }
function blFlash(cards, ms, bright) {
  return Promise.all(cards.map(el => blAnim(el, [{ filter: `brightness(${bright || 3}) saturate(.2)` }, { filter: 'brightness(1)' }], { duration: ms, easing: 'ease-out' })));
}
// One plate from a card to a chip, landing after `ms` (dncFly, the dance's own launcher).
function blPlate(from, box, kind, label, ms) {
  if (typeof dncFly !== 'function' || !box) return blWait(ms);
  return dncFly(from, box, label, kind === 'pips' ? BL_PIP : BL_MULT, null, ms, kind === 'pips' ? 'pipAdd' : 'multAdd');
}
function blChip(c, v) {
  if (!c || !c.el) return;
  c.el.textContent = c.kind === 'pips' ? Math.round(v) : blFmtM(v);
  if (typeof dncTick === 'function') dncTick(c.el);
}
function blPop(c, k) {
  if (!c || !c.box) return;
  blAnim(c.box, [{ scale: '1' }, { scale: `${k || 1.25}`, filter: 'brightness(1.6)' }, { scale: '1', filter: 'brightness(1)' }], { duration: 260, easing: 'cubic-bezier(.2,1.6,.4,1)' });
}
// The explosion: every card blown out of the preview in its own direction, spinning and
// fading, ease-in so it leaves hard. The preview clips it (css: .blast-clip), so nothing
// crosses the housing. The cards stay hidden after (the dance's settle clears them).
async function blExplode(cards, pace, sig) {
  const sc = document.getElementById('selected-cards'); if (sc) sc.classList.add('blast-clip');
  const rects = cards.map(el => el.getBoundingClientRect());
  const cx = rects.reduce((s, r) => s + r.left + r.width / 2, 0) / (rects.length || 1);
  const cy = rects.reduce((s, r) => s + r.top + r.height / 2, 0) / (rects.length || 1);
  const span = Math.max(80, ...rects.map(r => r.width)) * 4;
  const ms = Math.max(140, 420 / (pace || 1));
  await Promise.all(cards.map((el, i) => {
    const r = rects[i]; let ax = r.left + r.width / 2 - cx, ay = r.top + r.height / 2 - cy;
    const n = Math.hypot(ax, ay) || 1; ax /= n; ay /= n;
    const ang = Math.atan2(ay, ax) + (fxRandom() - .5) * 1.2;
    const dx = Math.cos(ang) * span + (fxRandom() - .5) * 40, dy = Math.sin(ang) * span - 30 + (fxRandom() - .5) * 60;
    const o = el.parentElement || el;
    if (o._blShake) { try { o._blShake.cancel(); } catch (e) {} o._blShake = null; }
    return blAnim(o, [
      { translate: '0 0', rotate: '0deg', scale: '1', opacity: 1 },
      { translate: `${(-dx * .06).toFixed(1)}px ${(-dy * .06).toFixed(1)}px`, rotate: '0deg', scale: '1.12', opacity: 1, offset: .12 },
      { translate: `${dx.toFixed(1)}px ${dy.toFixed(1)}px`, rotate: `${((fxRandom() - .5) * 520).toFixed(0)}deg`, scale: '.55', opacity: 0 }],
      { duration: ms, easing: 'cubic-bezier(.35,0,.95,.35)', fill: 'forwards' });
  }));
  cards.forEach(el => { const o = el.parentElement || el; o.style.visibility = 'hidden'; });
  if (sc) setTimeout(() => sc.classList.remove('blast-clip'), 50);
}
function blShakeScreen(ms) {
  if (document.body.classList.contains('no-shake')) return;
  const sc = document.getElementById('selected-cards'); if (!sc) return;
  const kf = []; for (let i = 0; i < 6; i++) kf.push({ translate: `${((fxRandom() - .5) * 8).toFixed(1)}px ${((fxRandom() - .5) * 6).toFixed(1)}px` });
  kf.push({ translate: '0 0' });
  blAnim(sc, kf, { duration: ms || 260, easing: 'linear' });
}
// A ring thrown out from the preview's centre (shockwave).
function blRing(sig) {
  const sc = document.getElementById('selected-cards'); if (!sc) return Promise.resolve();
  const ring = document.createElement('i'); ring.className = 'blast-ring'; sc.appendChild(ring);
  return blAnim(ring, [{ scale: '.1', opacity: 1 }, { scale: '5', opacity: 0 }], { duration: 480, easing: 'cubic-bezier(.1,.8,.3,1)' }).then(() => ring.remove());
}

// ── sounds (synthesised, like the particle step; a tone up per beat) ─────────
function sfxBlastBeat(i, kind) {
  if (typeof playTone !== 'function') return;
  const base = kind === 'mult' ? 660 : 440, f = base * Math.pow(1.0595, i * 2);
  playTone({ freq: f * 3, type: 'square', gain: .03, attack: .001, decay: .012, sustain: .05, release: .02, duration: .03 });
  playTone({ freq: f, type: kind === 'mult' ? 'sawtooth' : 'triangle', gain: .09, attack: .002, decay: .05, sustain: .12, release: .07, duration: .13 });
}
function sfxBlastRise(sec) {
  if (typeof ptVoice !== 'function') return;
  ptVoice((ctx, v, t) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(880, t + sec);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06 * v, t + sec * .6); g.gain.exponentialRampToValueAtTime(0.0001, t + sec);
    o.connect(g).connect(sfxOut(ctx)); o.start(t); o.stop(t + sec + .02);
  });
}
function sfxBlastBoom(big) {
  if (typeof ptVoice !== 'function') return;
  ptVoice((ctx, v, t) => {
    const noise = ptNoiseBuf(ctx, .42, (ts, p) => Math.pow(1 - p, 2.2));
    ptPlay(ctx, noise, t, (big ? .34 : .24) * v, 'lowpass', 1800, .7);
    const crack = ptNoiseBuf(ctx, .07, (ts, p) => 1 - p);
    ptPlay(ctx, crack, t, .18 * v, 'highpass', 2400, 1);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(36, t + .36);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(.4 * v, t + .01); g.gain.exponentialRampToValueAtTime(0.0001, t + .42);
    o.connect(g).connect(sfxOut(ctx)); o.start(t); o.stop(t + .45);
  });
}
function sfxBlastStatic() {
  if (typeof ptVoice !== 'function') return;
  ptVoice((ctx, v, t) => { const n = ptNoiseBuf(ctx, .06, (ts, p) => 1 - p * .6); ptPlay(ctx, n, t, .14 * v, 'bandpass', 1800 + Math.random() * 2400, .6); });
}
function sfxReelLever() {
  if (typeof ptVoice !== 'function') return;
  ptVoice((ctx, v, t) => {
    const n = ptNoiseBuf(ctx, .09, (ts, p) => 1 - p); ptPlay(ctx, n, t, .2 * v, 'lowpass', 500, .8);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(38, t + .14);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(.3 * v, t + .006); g.gain.exponentialRampToValueAtTime(0.0001, t + .16);
    o.connect(g).connect(sfxOut(ctx)); o.start(t); o.stop(t + .18);
  });
}
function sfxReelTick() { if (typeof playTone === 'function') playTone({ freq: 1800, type: 'square', gain: .02, attack: .001, decay: .01, sustain: .02, release: .01, duration: .02 }); }
function sfxReelBell(i) {
  if (typeof playTone !== 'function') return;
  const f = 880 * (1 + i * .34);
  playTone({ freq: f, type: 'sine', gain: .16, attack: .002, decay: .12, sustain: .3, release: .5, duration: .55 });
  playTone({ freq: f * 2.76, type: 'sine', gain: .05, attack: .002, decay: .08, sustain: .15, release: .3, duration: .3 });
  playTone({ freq: f * 4.1, type: 'triangle', gain: .025, attack: .001, decay: .03, sustain: .05, release: .1, duration: .1 });
}
function sfxBlastCymbal() {
  if (typeof ptVoice !== 'function') return;
  ptVoice((ctx, v, t) => { const n = ptNoiseBuf(ctx, .6, (ts, p) => Math.pow(1 - p, 1.4)); ptPlay(ctx, n, t, .16 * v, 'highpass', 5000, .8); });
}

// ── the looks ────────────────────────────────────────────────────────────────
// Each gets the context: cards (the preview's card elements), P / M ({ el, box,
// from, to, kind }), pace, sig, the shared helpers through closures above.
const BLAST_RUN = {
  // Five beats: PIPS, MULT, PIPS, MULT, PIPS. Each one a plate from a card to its chip
  // and a tone up; the chips climb in those five steps; the shake grows with each.
  async beats5({ cards, P, M, pace, sig }) {
    const gap = Math.max(70, 150 / pace);
    const seq = ['pips', 'mult', 'pips', 'mult', 'pips'];
    let pi = 0, mi = 0;
    for (let i = 0; i < seq.length; i++) {
      if (sig.aborted) return;
      const kind = seq[i], c = kind === 'pips' ? P : M;
      blShake(cards, 1.5 + i * 1.4, 100);
      sfxBlastBeat(i, kind);
      const n = kind === 'pips' ? ++pi : ++mi, of = kind === 'pips' ? 3 : 2;
      const v = c.from + (c.to - c.from) * n / of, d = c.to - c.from;
      const label = kind === 'pips' ? '+' + Math.round(Math.max(0, d) / of) : '+' + blFmtM(Math.max(0, d) / of);
      const src = cards[(i * 2 + 1) % cards.length] || cards[0];
      await blPlate(src, c.box, kind, label, gap);
      blChip(c, v); blPop(c, 1.18);
      blFlash([src], gap, 2);
    }
    await blWait(Math.max(60, 120 / pace), sig);
  },
  // Shockwave: a wind-up with a rising tone, then one slam.
  async shockwave({ cards, P, M, pace, sig }) {
    const wind = Math.max(220, 520 / pace);
    sfxBlastRise(wind / 1000);
    const steps = 5;
    for (let i = 0; i < steps; i++) { if (sig.aborted) return; blShake(cards, 1 + i * 1.6, 90); await blWait(wind / steps, sig); }
    cards.forEach(el => { const o = el.parentElement || el; blAnim(o, [{ scale: '1' }, { scale: '.86' }], { duration: 90, fill: 'forwards' }); });
    await blWait(90, sig);
    blFlash(cards, 220, 4); blRing(sig); blShakeScreen(300);
    sfxBlastBeat(6, 'pips'); sfxBlastBeat(6, 'mult');
    blChip(P, P.to); blChip(M, M.to); blPop(P, 1.4); blPop(M, 1.4);
    await blWait(Math.max(60, 140 / pace), sig);
  },
  // Strobe: three sweeps across the cards, each faster, a tone up a step per flash; the
  // chips show random figures between the old and the new until the last flash locks them.
  async strobe({ cards, P, M, pace, sig }) {
    const sweeps = [90, 55, 32], n = cards.length; let k = 0;
    const rnd = c => c.from + (c.to - c.from) * (.3 + fxRandom() * .7);
    for (const ms of sweeps) {
      for (let i = 0; i < n; i++) {
        if (sig.aborted) return;
        blFlash([cards[i]], ms * 1.8, 3.5); sfxBlastBeat(k++ % 12, i % 2 ? 'mult' : 'pips');
        blShake(cards, 1 + k * .35, 80);
        blChip(P, rnd(P)); blChip(M, rnd(M));
        await blWait(Math.max(18, ms / pace), sig);
      }
    }
    blChip(P, P.to); blChip(M, M.to); blPop(P, 1.3); blPop(M, 1.3); blFlash(cards, 160, 4);
    await blWait(Math.max(60, 140 / pace), sig);
  },
  // Implode: the cards are pulled into one point, hold shaking, then burst.
  async implode({ cards, P, M, pace, sig }) {
    const pull = Math.max(180, 380 / pace);
    const rects = cards.map(el => el.getBoundingClientRect());
    const cx = rects.reduce((s, r) => s + r.left + r.width / 2, 0) / rects.length, cy = rects.reduce((s, r) => s + r.top + r.height / 2, 0) / rects.length;
    sfxBlastRise(pull / 1000 * 1.1);
    [P, M].forEach(c => c.box && blAnim(c.box, [{ scale: '1', filter: 'brightness(1)' }, { scale: '.86', filter: 'brightness(.6)' }], { duration: pull, fill: 'forwards', easing: 'ease-in' }).then(a => a.cancel()));
    await Promise.all(cards.map((el, i) => { const r = rects[i], o = el.parentElement || el;
      return blAnim(o, [{ translate: '0 0', scale: '1', rotate: '0deg' }, { translate: `${(cx - r.left - r.width / 2).toFixed(1)}px ${(cy - r.top - r.height / 2).toFixed(1)}px`, scale: '.5', rotate: `${((fxRandom() - .5) * 60).toFixed(0)}deg` }],
        { duration: pull, easing: 'cubic-bezier(.6,0,.9,.4)', fill: 'forwards' }); }));
    if (sig.aborted) return;
    blShake(cards, 2.2, 70);
    await blWait(Math.max(60, 150 / pace), sig);
    blFlash(cards, 200, 4); blShakeScreen(320);
    sfxBlastBeat(5, 'pips'); sfxBlastBeat(7, 'mult');
    blChip(P, P.to); blChip(M, M.to); blPop(P, 1.45); blPop(M, 1.45);
    await blWait(40, sig);
  },
  // Drumroll: twelve small plates rattle onto the chips, each a sliver of the climb, the
  // gaps shrinking and the pitch rising, then a cymbal and the burst.
  async drumroll({ cards, P, M, pace, sig }) {
    const N = 12; let pi = 0, mi = 0;
    for (let i = 0; i < N; i++) {
      if (sig.aborted) return;
      const kind = i % 2 ? 'mult' : 'pips', c = kind === 'pips' ? P : M, of = N / 2;
      const n = kind === 'pips' ? ++pi : ++mi, gap = Math.max(22, (120 - i * 8) / pace);
      blShake(cards, 1 + i * .5, 70); sfxBlastBeat(i, kind);
      const src = cards[i % cards.length];
      blPlate(src, c.box, kind, (kind === 'pips' ? '+' + Math.round(Math.max(0, c.to - c.from) / of) : '+' + blFmtM(Math.max(0, c.to - c.from) / of)), gap * 1.6).then(() => blChip(c, c.from + (c.to - c.from) * n / of));
      await blWait(gap, sig);
    }
    await blWait(Math.max(60, 130 / pace), sig);
    sfxBlastCymbal(); blFlash(cards, 180, 3.5); blChip(P, P.to); blChip(M, M.to); blPop(P, 1.3); blPop(M, 1.3);
    await blWait(50, sig);
  },
};

// Overload: the preview screen fails. Static rolls over it, every card is torn sideways in
// strips, the chips flicker random figures through the noise, then the picture snaps back:
// the chips on their totals and the cards simply gone. No explosion (noExplode).
BLAST_RUN.overload = async function ({ cards, P, M, pace, sig }) {
  const sc = document.getElementById('selected-cards');
  const ov = document.createElement('i'); ov.className = 'blast-static'; if (sc) sc.appendChild(ov);
  const outers = cards.map(el => el.parentElement || el);
  const rnd = c => c.from + (c.to - c.from) * (.2 + fxRandom() * .9);
  const frames = 18, step = Math.max(24, 44 / pace);
  try {
    for (let i = 0; i < frames; i++) {
      if (sig.aborted) return;
      const k = i / frames;
      outers.forEach(o => {
        const tear = fxRandom() < .55 + k * .4;
        o.style.translate = tear ? `${((fxRandom() - .5) * 30 * (1 + k)).toFixed(1)}px 0` : '0 0';
        const a = Math.floor(fxRandom() * 60), b = Math.floor(fxRandom() * 40);
        o.style.clipPath = tear && fxRandom() < .6 ? `inset(${a}% 0 ${b}% 0)` : '';
        o.style.filter = `brightness(${(.5 + fxRandom() * 1.9).toFixed(2)}) contrast(${(1 + fxRandom() * .8).toFixed(2)})`;
      });
      ov.style.opacity = (.35 + fxRandom() * .55).toFixed(2);
      ov.style.backgroundPositionY = `${Math.floor(fxRandom() * 100)}%`;
      blChip(P, rnd(P)); blChip(M, rnd(M));
      [P, M].forEach(c => { if (c.box) c.box.style.filter = `brightness(${(.6 + fxRandom() * 1.6).toFixed(2)})`; });
      if (i % 3 === 0) sfxBlastStatic();
      if (i % 5 === 2 && sc) blShakeScreen(80);
      await blWait(step, sig);
    }
    // the snap: one white frame, the picture back, the cards gone, the figures lit
    outers.forEach(o => { o.style.translate = ''; o.style.clipPath = ''; o.style.filter = ''; });
    ov.style.opacity = '1'; ov.classList.add('blast-static-snap');
    [P, M].forEach(c => { if (c.box) c.box.style.filter = ''; });
    sfxBlastBoom(false);
    await blWait(Math.max(40, 90 / pace), sig);
    outers.forEach(o => { o.style.visibility = 'hidden'; });
    blChip(P, P.to); blChip(M, M.to); blPop(P, 1.35); blPop(M, 1.35);
    ov.classList.remove('blast-static-snap'); ov.style.opacity = '0';
    await blWait(Math.max(60, 160 / pace), sig);
  } finally { ov.remove(); outers.forEach(o => { o.style.translate = ''; o.style.clipPath = ''; o.style.filter = ''; }); [P, M].forEach(c => { if (c.box) c.box.style.filter = ''; }); }
};
BLAST_RUN.overload.noExplode = true;
// Reels: a lever clunk, then PIPS and MULT spin like slot reels (figures streaming past with
// a tick), PIPS lands first on a bell, MULT on a second; the cards are flung on that one.
BLAST_RUN.reels = async function ({ cards, P, M, pace, sig }) {
  sfxReelLever(); blShake(cards, 1.4, 120);
  [P, M].forEach(c => c.box && blAnim(c.box, [{ translate: '0 0' }, { translate: '0 5px' }, { translate: '0 0' }], { duration: 160, easing: 'ease-out' }));
  await blWait(Math.max(80, 180 / pace), sig);
  const tick = Math.max(28, 48 / pace), spinP = Math.max(300, 720 / pace), spinM = spinP + Math.max(200, 420 / pace);
  const t0 = performance.now();
  const spinFig = c => { const v = c.from + (c.to - c.from) * (fxRandom() * 1.4 - .1); blChip(c, Math.max(0, v)); };
  let landedP = false, n = 0;
  while (performance.now() - t0 < spinM) {
    if (sig.aborted) return;
    const dt = performance.now() - t0;
    if (!landedP) spinFig(P);
    spinFig(M);
    [landedP ? null : P, M].forEach(c => { if (c && c.el) c.el.animate([{ translate: '0 -40%', opacity: .2 }, { translate: '0 0', opacity: 1 }], { duration: tick, easing: 'linear' }); });
    if (n++ % 2 === 0) sfxReelTick();
    if (!landedP && dt >= spinP) { landedP = true; blChip(P, P.to); blPop(P, 1.35); sfxReelBell(0); blShake(cards, 2.4, 100); }
    await blWait(tick, sig);
  }
  blChip(M, M.to); blPop(M, 1.45); sfxReelBell(1); blFlash(cards, 160, 3);
  await blWait(Math.max(40, 80 / pace), sig);
};

// The one entry. ctx: { cards, pips: { el, box, from, to }, mult: {...}, pace, signal, look? }
async function scoreBlast(ctx) {
  const look = ctx.look || blastLook, run = BLAST_RUN[look];
  const cards = (ctx.cards || []).filter(Boolean);
  if (!run || !cards.length) return;
  const sig = ctx.signal || new AbortController().signal;
  const pace = Math.max(.5, ctx.pace || 1);
  const P = Object.assign({ kind: 'pips' }, ctx.pips), M = Object.assign({ kind: 'mult' }, ctx.mult);
  try {
    await run({ cards, P, M, pace, sig });
    if (sig.aborted) return;
    blChip(P, P.to); blChip(M, M.to);
    if (run.noExplode) { cards.forEach(el => { const o = el.parentElement || el; o.style.visibility = 'hidden'; }); }
    else { sfxBlastBoom(true); blShakeScreen(240); await blExplode(cards, pace, sig); }
  } finally { blShakeStop(cards); }
}
scoreBlast.on = blastOn;

// ── Preview (dev -> Aesthetics -> Blast scoring -> Preview) ──────────────────
// A mock hand of four board cards in the real preview, the real PIPS / MULT chips.
async function blastPreview(look) {
  if (typeof danceAbortController !== 'undefined' && danceAbortController) { if (typeof showMessage === 'function') showMessage('A hand is scoring. Wait.', '#ff6a3c', { plain: true }); return; }
  if (typeof toggleDevPanel === 'function' && document.getElementById('dev-panel')?.classList.contains('show')) toggleDevPanel();
  const stage = document.getElementById('selected-cards'); if (!stage) return;
  await blWait(200);
  const pick = [];
  if (typeof gridData !== 'undefined') for (const row of gridData || []) for (const c of row || []) if (c && !c._isStone && !c._isSleight && pick.length < 4) pick.push(c);
  while (pick.length < 4 && typeof makeTempCard === 'function') pick.push(makeTempCard(['7', 'J', 'Q', 'K'][pick.length], ['♠', '♥', '♦', '♣'][pick.length]));
  if (!pick.length) return;
  stage.classList.add('dnc-active'); if (typeof dncStageClear === 'function') dncStageClear(stage);
  if (typeof portraitDanceBegin === 'function') portraitDanceBegin();
  const row = document.createElement('div'); row.className = 'dnc-row hand';
  const items = document.createElement('div'); items.className = 'dnc-items'; const track = document.createElement('div'); track.className = 'dnc-track';
  row.appendChild(document.createElement('div')).className = 'dnc-lab'; row.appendChild(items); items.appendChild(track); stage.appendChild(row);
  const cards = pick.map((card, i) => { const o = document.createElement('div'); o.className = 'dnc-outer'; const d = document.createElement('div');
    const { className, innerHTML } = renderCardAppearance(card, 0, i, { revealFog: true }); d.className = className + ' preview-card'; d.innerHTML = innerHTML; o.appendChild(d); track.appendChild(o); return d; });
  if (typeof fitPortraitPreviewCards === 'function') fitPortraitPreviewCards();
  const pipsEl = document.getElementById('pips-val'), multEl = document.getElementById('mult-val');
  const P = { el: pipsEl, box: document.getElementById('pips-box'), from: 44, to: 312 }, M = { el: multEl, box: document.getElementById('mult-box'), from: 3, to: 21.5 };
  if (pipsEl) pipsEl.textContent = '44'; if (multEl) multEl.textContent = '3';
  await blWait(350);
  await scoreBlast({ cards, pips: P, mult: M, pace: 1, look: look || blastLook });
  await blWait(700);
  stage.classList.remove('dnc-active'); if (typeof dncStageClear === 'function') dncStageClear(stage);
  if (typeof portraitDanceEnd === 'function') portraitDanceEnd();
  if (typeof updateSelectionUI === 'function') updateSelectionUI();
}
document.addEventListener('DOMContentLoaded', () => setBlastLook(blastLook));

// ── The lab page: index.html?blast ───────────────────────────────────────────
// Starts a Flow run and shows a panel of the looks: a tap plays one on the real preview
// with real board cards, USE THIS makes the last played look the game's. The clock is
// topped up so nothing runs out while the owner looks. Nothing else is stored.
let _blastLabLast = null;
function blastLabOpen() {
  if (document.getElementById('blast-lab')) return;
  const p = document.createElement('div'); p.id = 'blast-lab';
  const looks = Object.keys(BLAST_LOOKS).filter(k => k !== 'off');
  p.innerHTML = `<div class="bl-head">BLAST SCORING <span class="bl-now"></span></div>`
    + `<div class="bl-row">${looks.map((k, i) => `<button class="bl-b" data-look="${k}">${i + 1} ${BLAST_LOOKS[k]}</button>`).join('')}</div>`
    + `<div class="bl-row"><button class="bl-b bl-use" id="bl-use">USE THIS</button><button class="bl-b" id="bl-off">USE NONE (fast forward)</button><button class="bl-b" id="bl-home" onclick="location.href='index.html'">EXIT</button></div>`
    + `<div class="bl-note">Tap a look to play it on the hand preview. USE THIS keeps the last one you played.</div>`;
  document.body.appendChild(p);
  const paint = () => { p.querySelector('.bl-now').textContent = 'now: ' + BLAST_LOOKS[blastLook]; p.querySelectorAll('.bl-b[data-look]').forEach(b => b.classList.toggle('bl-on', b.dataset.look === blastLook)); p.querySelectorAll('.bl-b[data-look]').forEach(b => b.classList.toggle('bl-last', b.dataset.look === _blastLabLast)); };
  p.addEventListener('click', e => {
    const b = e.target.closest('.bl-b'); if (!b) return;
    if (b.dataset.look) { _blastLabLast = b.dataset.look; paint(); blastPreview(b.dataset.look); }
    else if (b.id === 'bl-use' && _blastLabLast) { setBlastLook(_blastLabLast); paint(); }
    else if (b.id === 'bl-off') { setBlastLook('off'); paint(); }
  });
  paint();
}
(function () {
  if (!/[?&]blast\b/.test(location.search)) return;
  try { window.insightsOn = () => false; } catch (e) {}
  window.addEventListener('load', () => setTimeout(() => {
    try { devStartMode('flow'); } catch (e) { try { ACTIVE_MODE = MODES.flow; startGame(); } catch (e2) {} }
    setTimeout(() => {
      try { tutorialEnd(); } catch (e) {}
      blastLabOpen();
      setInterval(() => { try { if (typeof roundSeconds === 'number' && roundSeconds < 600) { roundSeconds = 3599; roundStartSeconds = 3599; updateClockUI?.(); } } catch (e) {} }, 1000);
    }, 2500);
  }, 1200));
})();
