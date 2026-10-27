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
const BLAST_LOOKS = { beats5: 'Five beats', shockwave: 'Shockwave', strobe: 'Strobe', implode: 'Implode', drumroll: 'Drumroll', off: 'Off (fast forward)' };
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
    sfxBlastBoom(true); blShakeScreen(240);
    blChip(P, P.to); blChip(M, M.to);
    await blExplode(cards, pace, sig);
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
