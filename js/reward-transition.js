// ══════════════════════════════════════════════════════════════════════════
// REWARD TRANSITIONS (r380) - one screen hands over to the next
// ══════════════════════════════════════════════════════════════════════════
// Owner: "we need an animation to go from card buffs to another reward screen.
// like having the cards explode or something, it feels too jumpy currently. let
// the ending of the buff screen breathe a tad, then get some transitions going.
// and this should probably go for all the options for rewards."
//
// Every board a reward is taken off - the shared pick-of-three (js/grid-pick.js,
// which is every Flow chain step, Survival's pick, the Schedule's picks and the
// Poker Squares picks) and the deck editor (js/flow-rewards.js) - leaves through
// this one function, in two beats:
//
//   1. BREATHE. The board holds. A chosen tile is marked (.rt-chosen) and the
//      rest dim, so the last thing on screen is the decision itself. After a
//      deck-edit reveal the hold is longer: the reveal is the payoff.
//   2. EXPLODE. Everything on the board flies outward from its centre and fades,
//      nearest first - the out leg of the win finale's blast (r280), which is
//      already the game's word for "this board is done".
//
// THE ELEMENTS ARE REMOVED AFTERWARDS, NOT RESTORED. A WAAPI animation left to
// fill pins transform and opacity (the r281 lesson), and cancelling it would pop
// the tile back into place for a frame. Every caller's next step either empties
// #grid anyway (a takeover) or redraws the board through render() / the deal-in,
// both of which rebuild a card element that is missing - render() reconciles by
// [data-card-id] and creates what it cannot find.
//
// The Settings -> Skip -> Screen transitions switch makes it synchronous.

const RT_BREATHE_MS = 420;    // after a pick: the choice holds the screen
const RT_OUT_MS     = 460;    // the explode itself
const RT_STAGGER_MAX = 150;   // nearest-first spread across the board

function rtSkipping() { return typeof skipOn === 'function' && skipOn('transitions'); }

// done: runs once, after the board has left. opts.chosen: the tile that was
// taken (it lifts rather than scatters). opts.breathe: override the hold.
function rewardTransitionOut(done, opts = {}) {
  let called = false;
  const finish = () => { if (called) return; called = true; try { done && done(); } catch (e) { console.error('[RT] continuation threw', e); } };
  const grid = document.getElementById('grid');
  if (rtSkipping() || !grid) { finish(); return; }
  if (typeof hideEntityTooltip === 'function') { try { hideEntityTooltip(true); } catch (e) {} }
  const chosen = opts.chosen || null;
  if (chosen) { chosen.classList.add('rt-chosen'); grid.classList.add('rt-has-chosen'); }
  setTimeout(() => {
    grid.classList.remove('rt-has-chosen');
    const els = [...grid.children].filter(el =>
      !el.classList.contains('rc-line') && el.tagName !== 'CANVAS' && el.offsetWidth > 0);
    if (!els.length) { finish(); return; }
    const gr = grid.getBoundingClientRect();
    const cx = gr.left + gr.width / 2, cy = gr.top + gr.height / 2;
    const maxD = Math.hypot(gr.width, gr.height) / 2 || 1;
    let end = 0;
    try { if (typeof sfxFlipShuffle === 'function') sfxFlipShuffle(); } catch (e) {}
    els.forEach(el => {
      try { el.getAnimations().forEach(a => a.cancel()); } catch (e) {}
      const r = el.getBoundingClientRect();
      let dx = r.left + r.width / 2 - cx, dy = r.top + r.height / 2 - cy;
      const d = Math.hypot(dx, dy);
      if (d < 1) { dx = 0; dy = -1; } else { dx /= d; dy /= d; }
      const rnd = (typeof fxRandom === 'function') ? fxRandom : Math.random;
      const dist = (190 + rnd() * 130);
      const rot = (rnd() - 0.5) * 80;
      const delay = Math.round((d / maxD) * RT_STAGGER_MAX);
      const kf = (el === chosen)
        ? [{ transform: 'translate(0,0) scale(1.06)', opacity: 1 },
           { transform: 'translate(0,-26px) scale(1.18)', opacity: 0 }]
        : [{ transform: 'translate(0,0)', opacity: 1 },
           { transform: `translate(${(dx * dist).toFixed(1)}px,${(dy * dist).toFixed(1)}px) rotate(${rot.toFixed(1)}deg) scale(.8)`, opacity: 0 }];
      el.style.pointerEvents = 'none';
      try {
        el.animate(kf, { duration: RT_OUT_MS, delay, easing: 'cubic-bezier(.45,0,.85,.4)', fill: 'forwards' });
      } catch (e) {}
      end = Math.max(end, delay + RT_OUT_MS);
    });
    setTimeout(() => {
      els.forEach(el => { try { el.remove(); } catch (e) {} });
      finish();
    }, end + 30);
  }, opts.breathe != null ? opts.breathe : RT_BREATHE_MS);
}
