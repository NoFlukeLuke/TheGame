// ══════════════════════════════════════════════
// COOLDOWN / DISABLE TIMER WIDGET  (r209)
// ══════════════════════════════════════════════
// ONE widget, used by everything that is temporarily unavailable or temporarily
// charged: a countdown ring with the seconds left in the middle, plus a grey-out
// of the host element while it is inactive.
//
// The rule that shapes the whole file: the widget NEVER re-renders its host.
// A Trick chip lives inside a marquee/fan that measures itself on build
// (js/tricks-ui.js, js/portrait-panel.js), and a card element is reused across
// renders by _id - rebuilding either four times a second would restart the
// marquee and throw away in-flight card animations. So `cdPaint` creates one
// `.cd-badge` child the first time and afterwards only writes its text and its
// `--cd-p` custom property; the ring is a conic-gradient reading that property.
//
// Two things ask the widget a question and it answers in ONE shape:
//   cdForTrick(trickId)  ·  cdForCard(card, r, c)   →  null, or
//   { mode, left, total, count, label, color }
//     mode 'off'      - switched off by a boss. Greyed, red ring, counts down.
//     mode 'cooldown' - the effect has fired and is waiting. Greyed, amber ring.
//     mode 'primed'   - charged and ready. NOT greyed; shows a charge count.
// A new timed entity is one row in TRICK_TIMERS or one entry in the card map -
// no new painting code, no new CSS.

const CD_COLORS = { off: '#d8474b', cooldown: '#e8a13a', primed: '#8a5cf0' };

// ── How long is "one cycle" for the once-per-minute Tricks ──────────────────
// firesThisMinute() (js/scoring.js) gates on whole round-minutes, so the wait is
// always "until the clock crosses the next minute boundary".
const CD_PER_MINUTE_TRICKS = ['study_hall', 'rowcol_perm_double', 'temporal_rift'];

function cdRoundElapsed() {
  if (typeof roundStartSeconds === 'undefined' || typeof roundSeconds === 'undefined') return 0;
  return Math.max(0, roundStartSeconds - roundSeconds);
}
// Seconds until the round clock crosses the next multiple of `every`.
function cdUntilNextMark(every) {
  const e = cdRoundElapsed();
  const left = every - (e % every);
  return left === 0 ? every : left;
}

// ── The per-Trick timer table ───────────────────────────────────────────────
// Each entry returns the widget shape (or null when the Trick has nothing to
// say right now). Anything a boss switched off is handled ahead of this table,
// so an entry only has to describe the Trick's OWN rhythm.
const TRICK_TIMERS = {
  // Once-per-minute gates. _perMinuteFired holds the minute index each id last
  // fired in; equal to the current minute means it has already gone this minute.
  _perMinute(id) {
    if (typeof _perMinuteFired === 'undefined') return null;
    const minute = Math.floor(cdRoundElapsed() / 60);
    if (_perMinuteFired[id] !== minute) return null;          // ready
    return { mode: 'cooldown', left: cdUntilNextMark(60), total: 60 };
  },
  // Minute Hand (reworked r209): every minute mark primes it for the next two
  // hands. Primed shows the charges; otherwise it counts down to the next mark.
  minute_hand() {
    if (typeof minuteHandCharges !== 'undefined' && minuteHandCharges > 0) {
      return { mode: 'primed', count: minuteHandCharges, label: 'hands' };
    }
    return { mode: 'cooldown', left: cdUntilNextMark(60), total: 60 };
  },
  // The Cuckoo pauses the clock once a minute of round time.
  cuckoo() { return { mode: 'cooldown', left: cdUntilNextMark(BAL.cuckoo.interval_seconds), total: BAL.cuckoo.interval_seconds }; },
  // Compound banks the round score on its own mark.
  compound() { return { mode: 'cooldown', left: cdUntilNextMark(BAL.compound.interval_seconds), total: BAL.compound.interval_seconds }; },
  // The Woodpecker marks a card in alternating 30s blocks - it is genuinely off
  // for half of every minute, which nothing said out loud before.
  woodpecker() {
    const blk = Math.floor(cdRoundElapsed() / 30);
    const left = cdUntilNextMark(30);
    return (blk % 2 === 0)
      ? { mode: 'primed', left, total: 30, label: 'marking' }
      : { mode: 'cooldown', left, total: 30 };
  },
};

// A Trick's live widget state, or null for "nothing to show".
function cdForTrick(trickId) {
  // 1. A boss switched it off. That beats the Trick's own rhythm - it cannot
  //    fire at all, so showing its cooldown would be a lie.
  if (typeof isTrickDisabledByBoss === 'function' && isTrickDisabledByBoss(trickId)) {
    const left = (typeof bossTrickOffSecondsLeft === 'function') ? bossTrickOffSecondsLeft(trickId) : null;
    const total = (typeof bossTrickOffTotal === 'function') ? bossTrickOffTotal(trickId) : null;
    return { mode: 'off', left, total };
  }
  // 2. Primed (the Understudy knack, the Rehearsal event's permanent rank, and
  //    the tray-order Tricks that prime their neighbours).
  const tray = (typeof trickTray !== 'undefined' ? trickTray : []) || [];
  const t = tray.find(x => x.id === trickId);
  const primed = t ? (t._primed || 0) : 0;
  if (primed > 0 && trickId !== 'minute_hand') return { mode: 'primed', count: primed };
  // 3. Its own rhythm.
  if (TRICK_TIMERS[trickId]) return TRICK_TIMERS[trickId](trickId);
  if (CD_PER_MINUTE_TRICKS.includes(trickId)) return TRICK_TIMERS._perMinute(trickId);
  return null;
}

// A card's live widget state. Today the only source is a boss hold (The Hold),
// which is the point of putting the lookup here rather than inside the boss.
function cdForCard(card, r, c) {
  if (typeof bossCardHoldSecondsLeft === 'function') {
    const info = bossCardHoldSecondsLeft(card);
    if (info) return { mode: 'off', left: info.left, total: info.total };
  }
  return null;
}

// ── Painting ────────────────────────────────────────────────────────────────
// Creates the badge once, then only writes text + --cd-p. `info === null`
// removes the badge and the grey-out, so a Trick coming back off cooldown
// cleans up without its host being rebuilt.
function cdPaint(el, info) {
  if (!el) return;
  const badge = el.querySelector(':scope > .cd-badge');
  if (!info) {
    if (badge) badge.remove();
    el.querySelectorAll(':scope > .cd-wash').forEach(w => w.remove());
    el.classList.remove('cd-inactive', 'cd-off', 'cd-cooldown', 'cd-primed');
    return;
  }
  let b = badge;
  if (!b) {
    b = document.createElement('div');
    b.className = 'cd-badge';
    b.innerHTML = '<span class="cd-num"></span>';
    el.appendChild(b);
  }
  const mode = info.mode;
  // Greyed only when the element genuinely cannot act. A primed entity is
  // MORE available than usual, so it keeps its colour.
  const dim = (mode === 'off' || mode === 'cooldown');
  el.classList.toggle('cd-inactive', dim);
  // The wash is what greys the host (see css/entity-fx.css for why it is not a
  // filter). Created once, removed the moment the host is available again.
  // A Trick tray chip switched off by a boss ALREADY drains itself and stamps OFF
  // (.trick-off, r188). Washing it as well double-dims it, so on that one host the
  // widget contributes only the ring - which is the part r188 could not give it.
  const selfDims = el.classList.contains('trick-off');
  let wash = el.querySelector(':scope > .cd-wash');
  if (dim && !selfDims && !wash) { wash = document.createElement('div'); wash.className = 'cd-wash'; el.appendChild(wash); }
  if ((!dim || selfDims) && wash) wash.remove();
  el.classList.toggle('cd-off',      mode === 'off');
  el.classList.toggle('cd-cooldown', mode === 'cooldown');
  el.classList.toggle('cd-primed',   mode === 'primed');
  b.classList.toggle('cd-b-primed', mode === 'primed');
  // A charge count (primed with no clock) prints the count; anything with a
  // clock prints whole seconds and fills the ring by how much is left.
  const num = b.querySelector('.cd-num');
  if (info.left == null) {
    num.textContent = info.count != null ? String(info.count) : '·';
    b.style.setProperty('--cd-p', '1');
  } else {
    num.textContent = String(Math.max(0, Math.ceil(info.left)));
    const total = info.total || Math.max(1, info.left);
    b.style.setProperty('--cd-p', String(Math.max(0, Math.min(1, info.left / total))));
  }
  b.style.setProperty('--cd-c', CD_COLORS[mode] || CD_COLORS.cooldown);
  b.title = mode === 'off' ? 'Switched off' : mode === 'cooldown' ? 'Recharging' : 'Primed';
}

// ── The driver ──────────────────────────────────────────────────────────────
// One 250ms interval walks the three host surfaces and repaints in place. It is
// deliberately cheap: a handful of querySelectorAll calls over rows that hold at
// most ~20 elements, and every write is a text node or a custom property.
let cdTicker = null;

// Deliberately NOT gated on gameTimerPaused: the clocks these rings read are
// round-seconds and boss wall-time, both of which already stop when the game
// does, so the numbers hold on their own. Skipping the sweep instead would leave
// a stale ring on screen through a shop or a pause menu.
function cdSweep() {
  // Trick chips (tray + its marquee clones + the portrait fan all carry the id).
  document.querySelectorAll('#trick-tray-list [data-trick-id]').forEach(chip => {
    cdPaint(chip, cdForTrick(chip.dataset.trickId));
  });
  // Grid cards.
  const gridEl = document.getElementById('grid');
  if (gridEl && typeof gridData !== 'undefined' && !(typeof rewardOnGrid !== 'undefined' && rewardOnGrid)) {
    gridEl.querySelectorAll('[data-card-id][data-row]').forEach(el => {
      const r = +el.dataset.row, c = +el.dataset.col;
      const card = gridData[r]?.[c];
      cdPaint(el, card ? cdForCard(card, r, c) : null);
    });
  }
  // Knack chips - the Understudy knack counts down to its next prime here.
  document.querySelectorAll('#knack-list [data-knack-id]').forEach(chip => {
    cdPaint(chip, (typeof cdForKnack === 'function') ? cdForKnack(chip.dataset.knackId) : null);
  });
}

function cdStartTicker() {
  if (cdTicker) return;
  cdTicker = setInterval(() => { try { cdSweep(); } catch (e) { console.error('[CD] sweep failed', e); } }, 250);
}
function cdStopTicker() {
  if (cdTicker) { clearInterval(cdTicker); cdTicker = null; }
  document.querySelectorAll('.cd-badge').forEach(b => b.remove());
  document.querySelectorAll('.cd-inactive,.cd-off,.cd-cooldown,.cd-primed')
    .forEach(el => el.classList.remove('cd-inactive', 'cd-off', 'cd-cooldown', 'cd-primed'));
}

// The Understudy knack (r209): primes a random Trick every 30 seconds. Its chip
// carries the countdown to the next prime, so the knack and the Trick it primes
// both speak through the same widget.
function cdForKnack(knackId) {
  if (knackId !== 'understudy') return null;
  if (typeof hasKnack !== 'function' || !hasKnack('understudy')) return null;
  const every = (typeof BAL !== 'undefined' && BAL.understudy) ? BAL.understudy.interval_seconds : 30;
  return { mode: 'cooldown', left: cdUntilNextMark(every), total: every };
}

// ── The card-side hook into renderCardAppearance ────────────────────────────
// render() rewrites a card's className and innerHTML wholesale, so the badge has
// to be part of that markup or it would be wiped and re-added by the next sweep
// - a visible flicker on every deal, swap and score. cdPaint still owns the
// per-second updates; this is only what the card is born with.
function cardCooldownParts(card, r, c) {
  const info = (card && card.rank) ? cdForCard(card, r, c) : null;
  if (!info) return { cls: '', html: '' };
  const left = info.left == null ? null : Math.max(0, Math.ceil(info.left));
  const p = (info.left == null || !info.total) ? 1 : Math.max(0, Math.min(1, info.left / info.total));
  const color = CD_COLORS[info.mode] || CD_COLORS.cooldown;
  const dim = info.mode === 'off' || info.mode === 'cooldown';
  return {
    cls: `cd-${info.mode}` + (dim ? ' cd-inactive' : ''),
    html: (dim ? '<div class="cd-wash"></div>' : '')
        + `<div class="cd-badge" style="--cd-p:${p};--cd-c:${color}">`
        + `<span class="cd-num">${left == null ? (info.count != null ? info.count : '\u00b7') : left}</span></div>`,
  };
}
