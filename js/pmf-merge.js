// ══════════════════════════════════════════════
// PMF MERGE  (r157)
// ══════════════════════════════════════════════
// The PIPS · MULT · FOCUS chips are the running arithmetic of a hand. Once all
// three have landed on their totals they stop being three numbers and become
// one: the score this hand just made. This animates that idea — the three chips
// jitter, slide sideways into each other and fuse into a single chip reading the
// hand's score; the main SCORE total then climbs by that amount; then the chip
// splits back into three ready for the next hand.
//
// Runs in BOTH orientations (owner's call — only the score-panel LAYOUT change
// is portrait-only). It works off measured rects rather than any assumed
// arrangement, so the landscape row and the portrait half-panel both animate
// correctly without a per-orientation branch.
//
// ── Where it sits in the dance ──
// playPreviewDance: card beats → pips/mult reconciled to totals → FOCUS beat →
// [MERGE] → SCORE climb → [SPLIT] → settle. The merge deliberately happens after
// the Focus beat, so the fused number matches what all three chips just showed.
//
// The legacy playScoreDance (the dev-only `newDance` = off path) is NOT wired:
// it runs its focus beat and score ticker on overlapping timers rather than in
// sequence, so there is no single point where "all three have landed" is true.
// Every mode that populates these chips uses the preview dance.

const PMF_CFG = {
  jitter: 300,   // shake before the merge
  merge:  340,   // chips slide together / fused chip grows in
  settle: 90,    // beat after the fuse, before the score starts climbing
  split:  300,   // fused chip back out to three
};

let _pmfMerged = null;     // the fused chip element (created once, reused)
let _pmfActive = false;

function _pmfParts() {
  const wrap = document.getElementById('score-subboxes');
  if (!wrap) return null;
  const boxes = ['pips-box', 'mult-box', 'focus-box'].map(id => document.getElementById(id)).filter(Boolean);
  if (boxes.length !== 3) return null;
  const times = [...wrap.querySelectorAll('.subbox-times')];
  return { wrap, boxes, times };
}

// Is there anything to animate? On grid-takeover screens (Rewards / Shop /
// Event) the chips are display:none and #screen-location shows in their place,
// so a merge there would fuse three invisible boxes.
function _pmfVisible(p) {
  if (!p) return false;
  const r = p.wrap.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  return p.boxes.every(b => b.getBoundingClientRect().width > 1);
}

function _pmfEnsureMerged(wrap) {
  if (_pmfMerged && _pmfMerged.parentNode === wrap) return _pmfMerged;
  if (_pmfMerged && _pmfMerged.parentNode) _pmfMerged.parentNode.removeChild(_pmfMerged);
  const el = document.createElement('div');
  el.id = 'pmf-merged';
  // No label (r169) — the fused chip is just the number. The word "HAND" was
  // redundant against the animation that put it there, and it stole the height
  // the number wanted.
  el.innerHTML = '<div class="pmf-merged-val">0</div>';
  wrap.appendChild(el);
  _pmfMerged = el;
  return el;
}

const _pmfWait = ms => new Promise(r => setTimeout(r, ms));

// Jitter → fuse into one chip reading `handScore`.
// `speed` divides every duration so the merge keeps pace with a fast-forwarded
// dance instead of dragging behind it.
async function pmfMergeIn(handScore, opts) {
  const o = opts || {};
  const speed = Math.max(0.25, o.speed || 1);
  const sig = o.signal;
  const p = _pmfParts();
  if (!_pmfVisible(p)) return false;
  const { wrap, boxes, times } = p;

  _pmfActive = true;

  // A pop animation still running would beat the merge transition on the same
  // property (animations win over transitions), so clear them first.
  boxes.forEach(b => b.classList.remove('subbox-pop'));

  // ── Jitter ──
  boxes.forEach(b => { b.classList.remove('pmf-jitter'); void b.offsetWidth; b.classList.add('pmf-jitter'); });
  if (typeof sfxScoreTick === 'function') sfxScoreTick();
  await _pmfWait(PMF_CFG.jitter / speed);
  if (sig && sig.aborted) { pmfResetNow(); return false; }
  boxes.forEach(b => b.classList.remove('pmf-jitter'));

  // ── Fuse ──
  // Each chip is told how far to travel to reach the row's centre, measured
  // live: the two orientations space these chips very differently, and a hand
  // can change the row's width between plays.
  const wr = wrap.getBoundingClientRect();
  const cx = wr.left + wr.width / 2;
  boxes.forEach(b => {
    const r = b.getBoundingClientRect();
    b.style.setProperty('--pmf-dx', Math.round(cx - (r.left + r.width / 2)) + 'px');
  });

  const merged = _pmfEnsureMerged(wrap);
  merged.querySelector('.pmf-merged-val').textContent = Math.round(handScore).toLocaleString();
  wrap.style.setProperty('--pmf-dur', Math.round(PMF_CFG.merge / speed) + 'ms');
  void merged.offsetWidth;

  wrap.classList.add('pmf-merging');
  merged.classList.add('show');
  if (typeof sfxFocusBeat === 'function') sfxFocusBeat();
  await _pmfWait((PMF_CFG.merge + PMF_CFG.settle) / speed);
  if (sig && sig.aborted) { pmfResetNow(); return false; }
  return true;
}

// The fused chip FLIES to the SCORE total (r173). This is the beat the owner
// asked to be unskippable: however hurried a hand's animation gets, the number it
// made must always be seen leaving the PMF row and landing on the score.
//
// A body-level fixed clone, like flyGridCardToSlot and flyMartTile: the row can
// re-render underneath and would otherwise yank the element out mid-flight. The
// cabinet's CSS zoom lives on #cabinet, and this sits outside it on <body>, so
// getBoundingClientRect coordinates map straight onto it.
async function pmfFlyToScore(opts) {
  const o = opts || {};
  const speed = Math.max(0.25, o.speed || 1);
  const target = document.getElementById('score-total-num');
  if (!target || !_pmfMerged || !_pmfMerged.classList.contains('show')) return false;
  const a = _pmfMerged.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  if (a.width < 2 || b.width < 1) return false;

  const ghost = _pmfMerged.cloneNode(true);
  ghost.removeAttribute('id');
  ghost.classList.add('show', 'pmf-flying');
  ghost.style.cssText = `position:fixed;margin:0;z-index:700;pointer-events:none;transition:none;` +
    `left:${a.left}px;top:${a.top}px;width:${a.width}px;height:${a.height}px;transform-origin:center center;`;
  document.body.appendChild(ghost);
  _pmfMerged.style.visibility = 'hidden';

  const dx = (b.left + b.width/2) - (a.left + a.width/2);
  const dy = (b.top  + b.height/2) - (a.top  + a.height/2);
  const dur = Math.max(110, 380 / speed);
  await new Promise(res => {
    let done = false;
    const fin = () => { if (done) return; done = true; res(); };
    const anim = ghost.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${dx*0.62}px, ${dy*0.62}px) scale(0.78)`, opacity: 1, offset: 0.65 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.28)`, opacity: 0 },
    ], { duration: dur, easing: 'cubic-bezier(.4,.1,.3,1)', fill: 'forwards' });
    anim.onfinish = fin;
    setTimeout(fin, dur + 160);          // rAF is throttled to zero in a background tab
  });
  ghost.remove();
  if (_pmfMerged) _pmfMerged.style.visibility = '';
  const box = document.getElementById('score-mid') || document.getElementById('score-center');
  if (box) { box.classList.remove('box-popping'); void box.offsetWidth; box.classList.add('box-popping'); }
  if (typeof sfxScoreTick === 'function') sfxScoreTick();
  return true;
}

// Fused chip back out to three.
async function pmfSplitOut(opts) {
  const o = opts || {};
  const speed = Math.max(0.25, o.speed || 1);
  const p = _pmfParts();
  if (!p || !_pmfActive) { pmfResetNow(); return; }
  const { wrap } = p;
  wrap.style.setProperty('--pmf-dur', Math.round(PMF_CFG.split / speed) + 'ms');
  wrap.classList.remove('pmf-merging');
  if (_pmfMerged) _pmfMerged.classList.remove('show');
  await _pmfWait(PMF_CFG.split / speed);
  pmfResetNow();
}

// Instant, unconditional teardown. Called on every dance abort — an interrupted
// hand must never leave the row fused, because the next hand writes its numbers
// into chips the player cannot see.
function pmfResetNow() {
  _pmfActive = false;
  const p = _pmfParts();
  if (p) {
    p.wrap.classList.remove('pmf-merging');
    p.wrap.style.removeProperty('--pmf-dur');
    p.boxes.forEach(b => { b.classList.remove('pmf-jitter'); b.style.removeProperty('--pmf-dx'); });
  }
  if (_pmfMerged) _pmfMerged.classList.remove('show');
}
