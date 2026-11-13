// ── THE SLOT MACHINE (r590, reels rebuilt r752) ─────────────────────────────
//
// The cabinet the slot events use (js/events-slots.js) and Spin to Improve's reel
// (js/events-upgrade.js). Owner, r590: "look and feel more like an actual slot
// (like cloverpit)", a lever to pull (gone r753). Owner, r752: "make it look like there's an
// actual slot rotating".
//
// - Each reel is a DRUM: the strip's symbols sit on the faces of a CSS 3D
//   cylinder (face j turned rotateX(-j x 360/F) and pushed out by the radius
//   H / (2 tan(PI / F)), so neighbouring faces meet), seen through a three-row
//   window. The middle row faces you; the rows above and below curve away,
//   shorter and darker. A short strip is repeated round the drum so it has at
//   least SLOT_FACE_MIN faces (a 3-face drum would be a prism). The order on the
//   drum is the strip's order, so what you saw spin is what lands.
// - A spin, per reel: a small kick back up (the reel is pulled before it is let
//   go), a run up to speed, a long run, a slow down onto the stop, a little past
//   it, and a damped settle back (a clunk as the brake catches). Reels start
//   SLOT.startGap apart and stop left to right. `tease` holds the last reel and
//   crawls it in while the stopped reels dim: the near miss.
// - Motion blur along the reel only: an SVG feGaussianBlur with stdDeviation
//   "0 s" on the reel window, s following the reel's speed, off at rest.
// - A tick for every symbol that passes the payline (rate limited, so at full
//   speed it is a rattle), a clunk per stop, the last one heavier.
// - No lever (owner, r753): the event's PLAY key pulls. The machine is handed its
//   stops before it moves (the toys' rule, js/event-toys.js).
//
// evSlotMachine(parent, opts) -> { el, spin(stops, { tease, len }) -> Promise, flash(cells, cls),
//   celebrate(lines) -> Promise, clear() }
//   spin's len multiplies every reel's run (Spin to Improve's single reel takes longer).
//   celebrate (r764): after a short rest each winning line is drawn through its cells
//   and lit, one at a time with a rising tone, then the cabinet holds a beat; the
//   caller pays once it resolves, so the win is seen before what it gives.
//   opts.reels   [strip, strip, ...], a strip being [{ key, html }]
//   opts.payRow  1 to light the middle row as the only line, or null
//   opts.itemW / itemH  a symbol's box in stage px

const SLOT = {
  faceMin: 12,        // fewest faces on a drum
  base: 1800,         // first reel's spin, ms (r764: 1500 -> 1800)
  stagger: 440,       // each later reel stops this much later (r764: 380 -> 440)
  tease: 1700,        // the last reel's extra time on a near miss
  startGap: 55,       // reels let go this far apart
  kick: 0.22,         // the pull back up before the spin, in faces
  kickMs: 140,
  over: 0.3,          // the stop runs this far past, in faces
  settleMs: 380,
  blurMax: 5,         // stage px of blur at full speed
  tickGap: 26,        // fewest ms between two ticks
  winPre: 380,        // r764: the reels rest this long before a win is shown
  winLine: 420,       // each winning line drawn this far after the last
  winHold: 1100,      // the celebration holds this long before the payout
};
let _slotUid = 0;

function evSlotMachine(parent, opts) {
  const o = opts || {};
  const W = o.itemW || 56, H = o.itemH || 46;
  const uid = ++_slotUid;
  const host = _etHost('evt-slot-host', parent);
  const drums = o.reels.map(strip => {
    const n = strip.length, F = n * Math.ceil(SLOT.faceMin / n);
    const th = 360 / F, R = H / (2 * Math.tan(Math.PI / F));
    return { strip, n, F, th, R };
  });
  host.innerHTML = `<svg class="evt-slot-defs" width="0" height="0" aria-hidden="true">${drums.map((d, k) =>
      `<filter id="evt-vb-${uid}-${k}" x="-5%" y="-30%" width="110%" height="160%"><feGaussianBlur stdDeviation="0 0"/></filter>`).join('')}</svg>
    <div class="evt-slot-cab">
      <div class="evt-slot-window" style="--sl-w:${W}px; --sl-h:${H}px">
        ${drums.map((d, k) => `<div class="evt-reel" data-k="${k}" style="--sl-r:${d.R.toFixed(2)}px"><div class="evt-drum">${
          Array.from({ length: d.F }, (_, j) => `<div class="evt-sym" data-i="${j % d.n}" style="transform: rotateX(${(-j * d.th).toFixed(3)}deg) translateZ(${d.R.toFixed(2)}px)">${d.strip[j % d.n].html}<i class="evt-sh"></i></div>`).join('')
        }</div></div>`).join('')}
        ${o.payRow != null ? '<div class="evt-payline"></div>' : ''}
        <div class="evt-slot-glass"></div>
      </div>
    </div>`;
  const reelEls = [...host.querySelectorAll('.evt-reel')];
  reelEls[reelEls.length - 1].classList.add('evt-reel-last');
  drums.forEach((d, k) => {
    d.el = reelEls[k];
    d.drum = d.el.querySelector('.evt-drum');
    d.faces = [...d.drum.children];
    d.shades = d.faces.map(f => f.querySelector('.evt-sh'));
    d.blur = host.querySelector(`#evt-vb-${uid}-${k} feGaussianBlur`);
    d.blurOn = 0;
    d.lit = [];
    d.p = Math.floor(_etRnd() * d.F);   // the face (fractional) at the front
  });

  // Draw a drum at front position p: one transform, the shading of the faces in
  // view (lit full at the front, darker as they turn away), the blur.
  const place = (d, p, speed) => {
    d.p = p;
    d.drum.style.transform = `translateZ(${(-d.R).toFixed(2)}px) rotateX(${(p * d.th).toFixed(3)}deg)`;
    const front = Math.round(p), lit = [];
    for (let r = -3; r <= 3; r++) {
      const j = ((front + r) % d.F + d.F) % d.F, rel = j - p - Math.round((j - p) / d.F) * d.F;
      const c = Math.cos(rel * d.th * Math.PI / 180);
      d.shades[j].style.opacity = Math.max(0, Math.min(.92, (1 - c) * 1.7)).toFixed(3);
      lit.push(j);
    }
    d.lit.forEach(j => { if (!lit.includes(j)) d.shades[j].style.opacity = '.92'; });
    d.lit = lit;
    const s = Math.max(0, Math.min(SLOT.blurMax, (speed || 0) * H / 60 * 0.45 - 0.6));
    if (s > 0.3) {
      d.blur.setAttribute('stdDeviation', `0 ${s.toFixed(1)}`);
      if (!d.blurOn) { d.el.style.filter = `url(#evt-vb-${uid}-${drums.indexOf(d)})`; d.blurOn = 1; }
    } else if (d.blurOn) { d.el.style.filter = ''; d.blurOn = 0; }
  };
  drums.forEach(d => { d.faces.forEach((f, j) => { d.shades[j].style.opacity = '.92'; }); place(d, d.p, 0); });

  // ── a spin ──
  // The main run's speed: up over the first a of it, flat, then down to nothing
  // over the last dd, so it creeps onto the stop. f(u) is the distance covered.
  const runCurve = (a, dd) => {
    const area = a / 2 + (1 - a - dd) + dd / 3;
    return u => {
      let s;
      if (u < a) s = u * u / (2 * a);
      else if (u < 1 - dd) s = a / 2 + (u - a);
      else { const w = (u - (1 - dd)) / dd; s = a / 2 + (1 - a - dd) + dd * (1 - Math.pow(1 - w, 3)) / 3; }
      return s / area;
    };
  };
  let lastTick = 0;
  const tick = v => {
    const now = performance.now();
    if (now - lastTick < SLOT.tickGap) return;
    lastTick = now;
    _etSfx('sfxSlotTick', Math.min(1, v / 14));
  };
  function spinReel(k, stop, ms, delay, slow) {
    const d = drums[k];
    return new Promise(res => {
      const p0 = d.p;
      if (_etFast()) {
        const pT = stop + d.n * Math.round((p0 - stop) / d.n);
        place(d, ((pT % d.F) + d.F) % d.F, 0); return res();
      }
      // At least two turns of travel, and land on a face that holds the stop.
      const minTravel = Math.max(2 * d.F, (ms / 1000) * 9);
      const pT = stop + d.n * Math.floor((p0 - minTravel - stop) / d.n);
      const D = p0 - pT, f = runCurve(0.14, slow ? 0.62 : 0.42);
      const run = ms - SLOT.kickMs - SLOT.settleMs;
      let t0 = null, prevP = p0, prevT = 0, clunked = false;
      const frame = now => {
        if (t0 === null) t0 = now + delay;
        const t = now - t0;
        if (t < 0) { requestAnimationFrame(frame); return; }
        let p;
        if (t < SLOT.kickMs) p = p0 + SLOT.kick * Math.sin(Math.PI * t / SLOT.kickMs);
        else if (t < SLOT.kickMs + run) p = p0 - (D + SLOT.over) * f((t - SLOT.kickMs) / run);
        else {
          if (!clunked) {
            clunked = true;
            _etSfx('sfxSlotStop', k === drums.length - 1 ? 1 : 0.6);
            d.el.classList.remove('evt-reel-land'); void d.el.offsetWidth; d.el.classList.add('evt-reel-land');
          }
          const u = Math.min(1, (t - SLOT.kickMs - run) / SLOT.settleMs);
          p = pT - SLOT.over * Math.exp(-5 * u) * Math.cos(2 * Math.PI * 1.15 * u);
        }
        const dt = Math.max(1, t - prevT), v = Math.abs(p - prevP) / dt * 1000;
        if (Math.floor(p) !== Math.floor(prevP)) tick(v);
        prevP = p; prevT = t;
        place(d, p, v);
        if (t < ms) { requestAnimationFrame(frame); return; }
        place(d, ((pT % d.F) + d.F) % d.F, 0);
        res();
      };
      requestAnimationFrame(frame);
    });
  }
  function spin(stops, so) {
    clear();
    const last = stops.length - 1, tease = !!(so && so.tease) && last > 0;
    const len = (so && so.len) || 1;
    return Promise.all(stops.map((s, k) => {
      let ms = (SLOT.base + k * SLOT.stagger) * len;
      if (tease && k === last) {
        ms += SLOT.tease;
        setTimeout(() => {
          host.classList.add('evt-tease');
          _etSfx('sfxChallengeWarn');
        }, _etFast() ? 0 : SLOT.base + (last - 1) * SLOT.stagger + last * SLOT.startGap);
      }
      return spinReel(k, s, ms, k * SLOT.startGap, tease && k === last);
    })).then(() => { host.classList.remove('evt-tease'); });
  }
  // cells: [[row, reel], ...] in window rows 0..2
  function flash(cells, cls) {
    cells.forEach(([r, k]) => {
      const d = drums[k], j = ((Math.round(d.p) + r - 1) % d.F + d.F) % d.F;
      d.faces[j].classList.add(cls || 'evt-sym-win');
    });
    host.classList.add('evt-slot-won');
  }
  // r764: draw each winning line through its cells' centres (window px: 6 pad, 6 gap).
  const win = host.querySelector('.evt-slot-window');
  function lineSvg(cells) {
    const n = drums.length, Wd = 12 + n * W + (n - 1) * 6, Hd = 12 + 3 * H;
    const pts = cells.map(([r, k]) => `${(6 + k * (W + 6) + W / 2).toFixed(1)},${(6 + H * (r + 0.5)).toFixed(1)}`);
    const [a, b] = [pts[0].split(',').map(Number), pts[pts.length - 1].split(',').map(Number)];
    const one = cells.length < 2, dx = one ? 1 : b[0] - a[0], dy = one ? 0 : b[1] - a[1], L = Math.hypot(dx, dy) || 1, ex = dx / L * W * 0.42, ey = dy / L * H * 0.42;
    const ends = `${(a[0] - ex).toFixed(1)},${(a[1] - ey).toFixed(1)} ${pts.join(' ')} ${(b[0] + ex).toFixed(1)},${(b[1] + ey).toFixed(1)}`;
    const el = document.createElement('div');
    el.className = 'evt-winline';
    el.innerHTML = `<svg viewBox="0 0 ${Wd} ${Hd}" width="${Wd}" height="${Hd}"><polyline points="${ends}" pathLength="1"/></svg>`;
    win.appendChild(el);
    return el;
  }
  function celebrate(lines) {
    if (!lines || !lines.length) return Promise.resolve();
    const fast = _etFast();
    return _etWait(fast ? 0 : SLOT.winPre).then(() => new Promise(res => {
      lines.forEach((cells, i) => setTimeout(() => {
        lineSvg(cells);
        flash(cells);
        _etSfx('sfxQuotaLine', i + 1);
      }, fast ? 0 : i * SLOT.winLine));
      setTimeout(() => { _etSfx('sfxChallengeWin'); }, fast ? 0 : lines.length * SLOT.winLine);
      setTimeout(res, fast ? 0 : (lines.length - 1) * SLOT.winLine + SLOT.winHold);
    }));
  }
  function clear() {
    host.querySelectorAll('.evt-sym-win, .evt-sym-near').forEach(el => el.classList.remove('evt-sym-win', 'evt-sym-near'));
    host.querySelectorAll('.evt-winline').forEach(el => el.remove());
    host.classList.remove('evt-slot-won');
  }
  return { el: host, spin, flash, celebrate, clear };
}

// ── sounds ──
// A reel tick: a short, dry click (filtered noise) with a little body, a touch
// brighter the faster the reel turns. At speed the rate limit turns them into a
// rattle. A stop: the brake catching, a low knock under a click; the last reel's
// is heavier.
function _slotNoise(ctx, ms) {
  const b = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * ms / 1000)), ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
  return b;
}
function sfxSlotTick(v) {
  try {
    const ctx = getAudioCtx(), out = sfxOut(ctx), t = ctx.currentTime;
    const vol = sfxVolume() * (typeof sfxIdGain === 'function' ? sfxIdGain() : 1);
    const src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = _slotNoise(ctx, 9);
    bp.type = 'bandpass'; bp.frequency.value = 2200 + (v || 0) * 1400; bp.Q.value = 3;
    g.gain.value = 0.16 * vol;
    src.connect(bp); bp.connect(g); g.connect(out); src.start(t);
  } catch (e) {}
}
function sfxSlotStop(k) {
  try {
    const ctx = getAudioCtx(), out = sfxOut(ctx), t = ctx.currentTime, w = k == null ? 0.6 : k;
    const vol = sfxVolume() * (typeof sfxIdGain === 'function' ? sfxIdGain() : 1);
    const o = ctx.createOscillator(), og = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(58, t + 0.09);
    og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime((0.22 + 0.18 * w) * vol, t + 0.004);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(og); og.connect(out); o.start(t); o.stop(t + 0.14);
    const n = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), ng = ctx.createGain();
    n.buffer = _slotNoise(ctx, 22); lp.type = 'lowpass'; lp.frequency.value = 1800; ng.gain.value = (0.18 + 0.12 * w) * vol;
    n.connect(lp); lp.connect(ng); ng.connect(out); n.start(t);
  } catch (e) {}
}
