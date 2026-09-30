// ══════════════════════════════════════════════════════════════════════════
// THE CLOCK TRACK (r377) - everything drawn ON the round clock's bar
// ══════════════════════════════════════════════════════════════════════════
//
// The bar used to be a fill and one decoration: #vclock-band, a hatched stripe
// nailed to 33%-67% of the track that named no Trick, moved with no clock and
// meant nothing. It is gone. What the bar carries now is read from the live
// round every time it repaints:
//
//   1. BANDS   - alternate 30-second stretches are textured, so "how much has
//                gone" is countable rather than a length to eyeball.
//   2. WINDOWS - a Trick that only fires in part of the round (the middle
//                third, the last third, the first 45 seconds) hatches THAT
//                stretch in its own colour, with the Trick's glyph on it.
//   3. MARKS   - a vertical line per level-up, on the clocks that SPAN
//                level-ups. Flow's session clock and Crunch's act bank run
//                across several rounds, so the marks are the progress through
//                them; every other mode refills its clock each round and there
//                would be nothing for a mark to mean.
//
// ── THE TRACK IS A WRAPPER, AND IT HAS TO BE ────────────────────────────────
// The host (#vclock in landscape, #clock-bar-wrap in portrait) also holds the
// Flow boss mark, and the fill must stop short of it. `padding-right` on the
// host does NOT do that: an absolutely-positioned child's containing block is
// the host's PADDING BOX, which includes the padding, so #vclock-fill ran
// straight under the skull. So the fill is MOVED into .clk-track, which is
// inset from the host, and the layers go in beside it. Nothing in
// js/round-timers.js changed: it still writes #vclock-fill / #clock-bar's
// width, and a percentage there is now a percentage of the track.
//
// ── POSITION ON THE TRACK IS clockTrackPos(seconds) ─────────────────────────
// A draining bar shrinks right-to-left, so x IS the fraction remaining; Flow's
// fills left-to-right toward the review, so x is the fraction ELAPSED. One
// function answers both, and every layer places itself through it - otherwise
// the hatching would sit on the wrong half of a Flow clock.

const CLOCK_BAND_SECONDS = 30;     // the texture's stripe width, in clock seconds

// A Trick that only fires inside part of the round. `win(rs)` returns the
// stretch in SECONDS REMAINING, because that is what every one of these tests
// against (roundFractionRemaining × roundStartSeconds). Keep a row faithful to
// the site that reads it - First Wind measures its grace against ROUND_DURATION
// rather than the round's own length, so its row does too.
const CLOCK_WINDOW_TRICKS = [
  { id:'early_bird',   glyph:'🌅', color:'#5aa9e6', win: rs => ({ lo: rs * 2/3, hi: rs }) },
  { id:'eye_of_storm', glyph:'🌀', color:'#c07aee', win: rs => ({ lo: rs / 3,   hi: rs * 2/3 }) },
  { id:'night_owl',    glyph:'🦉', color:'#e08a3a', win: rs => ({ lo: 0,        hi: rs / 3 }) },
  { id:'closing_time', glyph:'🔻', color:'#e04a5a', win: rs => ({ lo: 0,        hi: rs / 3 }) },
  { id:'first_wind',   glyph:'🎯', color:'#54af88',
    win: () => ({ lo: Math.max(0, (typeof ROUND_DURATION === 'number' ? ROUND_DURATION : 180) - 45),
                  hi: Infinity }) },
];

// A LEVEL-UP MARK is the seconds the clock read when the level was banked, so
// it is repositioned by the same formula the fill is and cannot drift out of
// step with it. Cleared when the clock is REFILLED (detected in
// startRoundTimer: the clock gained time), and on a new run.
let clockLevelMarks = [];

// Only the clocks that outlive a round can carry a level-up mark. Everywhere
// else the clock refills at the level-up itself, so a mark would sit on a
// track that no longer describes the time it was taken in.
function clockSpansLevels() {
  return (typeof flowActive === 'function' && flowActive())
      || (typeof crunchActive === 'function' && crunchActive());
}
function clockMarkLevelUp() {
  if (!clockSpansLevels()) return;
  if (clockLevelMarks.length >= 40) return;      // a very long Crunch quarter
  clockLevelMarks.push(Math.max(0, roundSeconds));
}
function clockMarksReset() { clockLevelMarks = []; }

// Is the bar FILLING toward something (Flow's review) or DRAINING? The one
// place this is decided, read by updateClockUI and by every layer here.
function clockTrackFills() {
  return (typeof flowActive === 'function' && flowActive())
      && !(typeof bossActive !== 'undefined' && bossActive);
}
// Where a given "seconds left" sits along the track, 0 (left) to 1 (right).
function clockTrackPos(secs) {
  const dur = (typeof currentRoundDuration === 'function') ? currentRoundDuration() : 0;
  if (!(dur > 0)) return 0;
  const f = Math.max(0, Math.min(1, secs / dur));
  return clockTrackFills() ? 1 - f : f;
}

// ── The hosts ───────────────────────────────────────────────────────────────
// Both exist in the document at once; only one is ever laid out (the other is
// display:none for its orientation), so both are kept in step and neither has
// to know which is live.
function clockTrackHosts() {
  return ['vclock', 'clock-bar-wrap'].map(id => document.getElementById(id)).filter(Boolean);
}

// Build the wrapper once per host and move the existing fill into it. The fill
// element is the one js/round-timers.js writes, so it is REPARENTED rather than
// replaced - a second fill would be a second thing to keep in step.
function clockTrackEnsure(host) {
  let track = host.querySelector(':scope > .clk-track');
  if (track) return track;
  track = document.createElement('div');
  track.className = 'clk-track';
  track.innerHTML = '<div class="clk-bands"></div><div class="clk-wins"></div><div class="clk-marks"></div>';
  host.insertBefore(track, host.firstChild);
  const fill = host.querySelector(':scope > #vclock-fill, :scope > #clock-bar');
  if (fill) track.insertBefore(fill, track.querySelector('.clk-wins'));
  return track;
}

// ── The repaint ─────────────────────────────────────────────────────────────
// Called from updateClockUI, i.e. once a second and on every clock event. The
// bands are a CSS gradient (one custom property), the windows and marks are a
// handful of absolutely-positioned divs rebuilt only when their DESCRIPTION
// changes - a blind rebuild every second would restart the marks' own reveal.
let _clkWinKey = '', _clkMarkKey = '';
function renderClockTrack() {
  const dur = (typeof currentRoundDuration === 'function') ? currentRoundDuration() : 0;
  const rs  = (typeof roundStartSeconds === 'number' && roundStartSeconds > 0) ? roundStartSeconds : dur;
  const hosts = clockTrackHosts();
  if (!hosts.length) return;

  // 1. BANDS. A stripe every CLOCK_BAND_SECONDS, so the period is two of them.
  const bandPct = dur > 0 ? (CLOCK_BAND_SECONDS / dur) * 100 : 0;

  // 2. WINDOWS, from the loadout. Deduped by the stretch they cover, so Night
  //    Owl and Near Extinction - the same last third - draw one hatch rather
  //    than two on top of each other.
  const wins = [];
  if (typeof hasTrick === 'function') {
    const seen = new Set();
    CLOCK_WINDOW_TRICKS.forEach(w => {
      if (!hasTrick(w.id)) return;
      if (typeof isTrickDisabledByBoss === 'function' && isTrickDisabledByBoss(w.id)) return;
      const { lo, hi } = w.win(rs);
      const a = clockTrackPos(lo), b = clockTrackPos(Math.min(hi, dur));
      const left = Math.min(a, b) * 100, right = Math.max(a, b) * 100;
      if (right - left < 0.5) return;
      const key = `${left.toFixed(1)}-${right.toFixed(1)}`;
      if (seen.has(key)) return;
      seen.add(key);
      wins.push({ left, width: right - left, color: w.color, glyph: w.glyph, id: w.id });
    });
  }
  const winKey = wins.map(w => `${w.id}:${w.left.toFixed(1)}:${w.width.toFixed(1)}`).join('|');

  // 3. MARKS.
  const marks = clockSpansLevels() ? clockLevelMarks.map(s => clockTrackPos(s) * 100) : [];
  const markKey = marks.map(m => m.toFixed(1)).join('|');

  hosts.forEach(host => {
    const track = clockTrackEnsure(host);
    track.style.setProperty('--clk-band', bandPct > 0.2 ? bandPct + '%' : '0%');
    if (winKey !== _clkWinKey) {
      track.querySelector('.clk-wins').innerHTML = wins.map(w =>
        `<div class="clk-win" style="left:${w.left}%;width:${w.width}%;--cw:${w.color}">`
        + `<span class="clk-win-g">${w.glyph}</span></div>`).join('');
    }
    if (markKey !== _clkMarkKey) {
      track.querySelector('.clk-marks').innerHTML = marks.map(m =>
        `<div class="clk-mark" style="left:${m}%"></div>`).join('');
    }
  });
  _clkWinKey = winKey; _clkMarkKey = markKey;
}
