// ══ THE EVENT REVEAL (r795, owner) ═══════════════════════════════════════════
// Flow's event reward step names its event on the board before the event opens,
// the Schedule's mystery reveal's way (r794): what the board holds falls out of
// its box, the amber glass comes up, a cursor blinks REVEAL_CFG.beats times, then
// "> EVENT:" types over the event's name with a text blip a character
// (sfxTypeTick), holds, and openEvent shows the event over it. A tap ends the
// typing, a second the hold. The fall is cancelled once the event is up, so the
// board under it is whole again for whatever comes next.
const REVEAL_CFG = { beat: 520, beats: 3, hold: 1100 };

function revealCalm() {
  return (typeof skipOn === 'function' && skipOn('transitions')) || document.body.classList.contains('reduced-motion');
}

// What #grid holds drops out of the bottom of its box. Returns the animations so
// they can be cancelled (fill: forwards would keep the board hidden for good).
function revealFallOut() {
  const grid = document.getElementById('grid');
  if (!grid || revealCalm()) return [];
  const els = [...grid.children].filter(el => el.offsetWidth && el.offsetHeight && getComputedStyle(el).position !== 'static');
  const anims = [];
  els.forEach((el, i) => {
    try {
      anims.push(el.animate([{ translate: '0 0', opacity: 1 }, { translate: '0 420px', opacity: 0 }],
        { duration: 360, delay: Math.min(i, 24) * 14, easing: 'cubic-bezier(.5,0,.9,.4)', fill: 'forwards' }));
    } catch (e) {}
  });
  try { if (anims.length && typeof sfxCardDiscard === 'function') sfxCardDiscard(); } catch (e) {}
  return anims;
}

function revealEventOnBoard(id) {
  const meta = (typeof EVENT_META !== 'undefined' && EVENT_META[id]) || null;
  const name = String((meta && meta.name) || 'Event').toUpperCase();
  if (typeof noteMessage === 'function') noteMessage(`Event: ${meta ? meta.name : id}`);
  if (typeof boardScreenOpen !== 'function') return Promise.resolve(null);
  const falls = revealFallOut();
  const wait = (ms) => new Promise(res => setTimeout(res, ms));
  const settle = falls.length ? Promise.all(falls.map(a => a.finished.catch(() => {}))) : Promise.resolve();
  return settle.then(() => {
    const html = `<div class="rv-line"><span class="rv-text">&gt; EVENT:<br><b>${bsEsc(name)}</b></span><i class="bs-cur rv-wait"></i></div>`;
    const ctl = boardScreenOpen({ html, cls: 'rv-screen' });
    if (!ctl) return null;
    ctl.typeSound = true;
    const line = ctl.body.querySelector('.rv-line'), text = line.querySelector('.rv-text'), waitCur = line.querySelector('.rv-wait');
    text.style.display = 'none';   // only the cursor shows while it blinks
    let skipBeats = null, holdEnd = null;
    ctl.el.addEventListener('pointerdown', () => { if (skipBeats) skipBeats(); else if (holdEnd) holdEnd(); });
    const beats = new Promise(res => {
      const t = setTimeout(res, REVEAL_CFG.beat * REVEAL_CFG.beats);
      skipBeats = () => { clearTimeout(t); res(); };
    });
    return beats.then(() => {
      skipBeats = null;
      waitCur.remove(); text.style.display = '';
      return bsType(text, ctl);
    }).then(() => {
      line.classList.add('rv-done');
      try { if (typeof sfxRewardTaken === 'function') sfxRewardTaken(); } catch (e) {}
      return new Promise(res => { const t = setTimeout(res, REVEAL_CFG.hold); holdEnd = () => { clearTimeout(t); res(); }; });
    }).then(() => () => {
      // The event is up: take the glass down under it and give the board back.
      try { ctl.close(true); } catch (e) {}
      falls.forEach(a => { try { a.cancel(); } catch (e) {} });
    });
  }).catch(() => () => falls.forEach(a => { try { a.cancel(); } catch (e) {} }));
}
