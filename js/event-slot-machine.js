// ── THE SLOT MACHINE (r590) ─────────────────────────────────────────────────
//
// The cabinet both slot events use (js/events-slots.js). Owner: "make the order
// of the reels consistent so you can actually see the slot slowing down and
// landing (sort of snapping) into its final place with the item above and below
// it ... look and feel more like an actual slot (like cloverpit)", and "make the
// spin button a slots arm you have to pull down".
//
// - Each reel is a FIXED strip of symbols, repeated, seen through a three-row
//   window. A stop index names the symbol that lands in the MIDDLE row; the rows
//   above and below show its strip neighbours, so what you saw spin is what lands.
// - The reels stop left to right, each with a small overshoot and a snap back
//   (and a clunk). `tease` holds the last reel longer and slower: the near miss.
// - The lever: drag the knob down (or tap it) and it pulls, clunks at the bottom
//   and springs back with a wobble. The machine is handed its stops before it
//   moves (the toys' rule, js/event-toys.js); the lever only starts it.
//
// evSlotMachine(parent, opts) -> { el, spin(stops, { tease }) -> Promise, lever(on, label), flash(cells), clear() }
//   opts.reels   [strip, strip, ...], a strip being [{ key, html }]
//   opts.payRow  1 to light the middle row as the only line, or null
//   opts.itemW / itemH  a symbol's box in stage px
//   opts.onPull  called when the lever is pulled while it is enabled

const SLOT_COPIES = 5, SLOT_BASE_MS = 1100, SLOT_STAGGER_MS = 340, SLOT_TEASE_MS = 1200, SLOT_OVERSHOOT = 0.22;

function evSlotMachine(parent, opts) {
  const o = opts || {};
  const W = o.itemW || 56, H = o.itemH || 46;
  const host = _etHost('evt-slot-host', parent);
  host.innerHTML = `<div class="evt-slot-cab">
      <div class="evt-slot-window" style="--sl-w:${W}px; --sl-h:${H}px">
        ${o.reels.map((strip, k) => `<div class="evt-reel" data-k="${k}"><div class="evt-reel-strip">${
          Array.from({ length: SLOT_COPIES }, () => strip.map((s, i) => `<div class="evt-sym" data-i="${i}">${s.html}</div>`).join('')).join('')
        }</div></div>`).join('')}
        ${o.payRow != null ? '<div class="evt-payline"></div>' : ''}
        <div class="evt-slot-glass"></div>
      </div>
      <div class="evt-lever off"><div class="evt-lever-slot"></div><div class="evt-lever-arm"><div class="evt-lever-knob"></div></div><div class="evt-lever-cap"></div></div>
    </div>`;
  const reels = [...host.querySelectorAll('.evt-reel-strip')];
  const lens = o.reels.map(s => s.length);
  const cur = lens.map(n => n + Math.floor(_etRnd() * n));          // absolute middle index, kept in copy 2
  const place = (k, abs) => { reels[k].style.transform = `translateY(${-(abs - 1) * H}px)`; };
  cur.forEach((a, k) => place(k, a));

  // ── the lever ──
  const lev = host.querySelector('.evt-lever'), arm = host.querySelector('.evt-lever-arm'), knob = host.querySelector('.evt-lever-knob');
  const cap = host.querySelector('.evt-lever-cap');
  const TRAVEL = 58;
  let enabled = false, pulling = false;
  const setArm = d => { arm.style.setProperty('--lv', (d / TRAVEL).toFixed(3)); };
  const release = from => _etTween(_etFast() ? 0 : 520, (e, t) => {
    // a damped spring back up: overshoots above rest, then settles
    const d = from * Math.exp(-6 * t) * Math.cos(t * Math.PI * 2.6);
    setArm(Math.max(-10, d));
  }, t => t).then(() => setArm(0));
  const fire = () => {
    pulling = true;
    _etSfx('sfxScreenLatch');
    release(TRAVEL).then(() => { pulling = false; });
    if (o.onPull) o.onPull();
  };
  knob.addEventListener('pointerdown', e => {
    if (!enabled || pulling) return;
    e.preventDefault();
    const z = lev.getBoundingClientRect().height / (lev.offsetHeight || 1) || 1;
    const y0 = e.clientY;
    let d = 0, moved = false;
    const move = ev => { d = Math.max(0, Math.min(TRAVEL, (ev.clientY - y0) / z)); if (d > 3) moved = true; setArm(d); };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      if (!moved) {   // a tap pulls it for you
        pulling = true;
        _etTween(_etFast() ? 0 : 180, e2 => setArm(TRAVEL * e2), t => t * t).then(() => { pulling = false; fire(); });
        return;
      }
      if (d >= TRAVEL * 0.7) { setArm(TRAVEL); fire(); }
      else release(d);
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  });

  function lever(on, label) {
    enabled = !!on;
    lev.classList.toggle('off', !enabled);
    // "PULL · 8" prints as two lines, the word over the price
    cap.innerHTML = String(label || '').split(' · ').map(t => `<div>${t}</div>`).join('');
  }

  // ── a spin ──
  function spinReel(k, stop, ms) {
    const n = lens[k], from = cur[k];
    const to = stop + 3 * n;                                        // copy 4: always at least a full turn away
    const over = to + SLOT_OVERSHOOT;
    const strip = reels[k];
    return new Promise(res => {
      if (_etFast()) { cur[k] = stop + n; place(k, cur[k]); return res(); }
      const t0 = performance.now(), main = ms * 0.86, back = ms - main;
      strip.classList.add('evt-reel-blur');
      const frame = now => {
        const t = now - t0;
        let a;
        if (t < main) {
          const u = t / main;
          a = from + (over - from) * (1 - Math.pow(1 - u, 3.2));
          if (u > 0.72) strip.classList.remove('evt-reel-blur');
        } else {
          const u = Math.min(1, (t - main) / back);
          a = over - SLOT_OVERSHOOT * (u * u * (3 - 2 * u));
        }
        place(k, a);
        if (t < ms) { requestAnimationFrame(frame); return; }
        cur[k] = stop + n; place(k, cur[k]);
        strip.classList.remove('evt-reel-blur');
        const reel = strip.parentElement; reel.classList.remove('evt-reel-land'); void reel.offsetWidth; reel.classList.add('evt-reel-land');
        _etSfx('sfxChallengeTap');
        res();
      };
      requestAnimationFrame(frame);
    });
  }
  function spin(stops, so) {
    clear();
    _etSfx('sfxFlipShuffle');
    const last = stops.length - 1;
    return Promise.all(stops.map((s, k) => {
      let ms = SLOT_BASE_MS + k * SLOT_STAGGER_MS;
      if (so && so.tease && k === last) ms += SLOT_TEASE_MS;
      if (so && so.tease && k === last) setTimeout(() => { host.classList.add('evt-tease'); _etSfx('sfxChallengeWarn'); }, SLOT_BASE_MS + (last - 1) * SLOT_STAGGER_MS);
      return spinReel(k, s, ms);
    })).then(() => { host.classList.remove('evt-tease'); });
  }
  // cells: [[row, reel], ...] in window rows 0..2
  function flash(cells, cls) {
    cells.forEach(([r, k]) => {
      const el = reels[k].children[cur[k] + r - 1];
      if (el) el.classList.add(cls || 'evt-sym-win');
    });
    host.classList.add('evt-slot-won');
  }
  function clear() {
    host.querySelectorAll('.evt-sym-win, .evt-sym-near').forEach(el => el.classList.remove('evt-sym-win', 'evt-sym-near'));
    host.classList.remove('evt-slot-won');
  }
  return { el: host, spin, lever, flash, clear };
}
