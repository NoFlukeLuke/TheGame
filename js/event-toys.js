// ── EVENT TOYS (r576) ───────────────────────────────────────────────────────
//
// The animated widgets the gamble events share: a coin, a wheel, a die, a plinko
// board and a highlight you stop with a tap. One file so every event's coin looks
// and sounds like every other event's coin.
//
// EVERY RESULT IS DECIDED BEFORE A PIXEL MOVES, except the stopper's, which IS
// the player's tap. A toy is handed its outcome and only shows it, the rule
// spinDrawWheel and the slot reels already follow: an interrupted or janky
// animation can never change what you get, and a backgrounded tab cannot either.
//
// Cosmetic jitter (turn counts, flicker faces, landing offsets) uses fxRandom(),
// never Math.random, so a seeded run's gameplay draws are not shifted by it.
//
// Toys mount inside #event-body, which is inside #stage and carries its zoom:
// every px here is a stage px.

function _etRnd() { return (typeof fxRandom === 'function') ? fxRandom() : Math.random(); }
function _etFast() { return document.body.classList.contains('reduced-motion'); }
function _etSfx(fn, ...a) { try { if (typeof window[fn] === 'function') window[fn](...a); } catch (e) {} }
function _etHost(cls, parent) {
  const d = document.createElement('div');
  d.className = 'evt-host ' + (cls || '');
  (parent || document.getElementById('event-body')).appendChild(d);
  return d;
}
// rAF tween: f(t) for t 0..1 on an ease-out curve. Resolves when done.
function _etTween(ms, f, ease) {
  const e = ease || (t => 1 - Math.pow(1 - t, 4));
  return new Promise(res => {
    if (_etFast() || ms <= 0) { f(1); res(); return; }
    const t0 = performance.now();
    const step = now => {
      const t = Math.min(1, (now - t0) / ms);
      f(e(t), t);
      if (t < 1) requestAnimationFrame(step); else res();
    };
    requestAnimationFrame(step);
  });
}
function _etWait(ms) { return new Promise(r => setTimeout(r, _etFast() ? 0 : ms)); }
// Bring a toy or a result into view inside the scrolling event panel. A stage
// appended under three offers otherwise plays out behind the sticky footer.
function evReveal(el) {
  if (!el) return;
  requestAnimationFrame(() => { try { el.scrollIntoView({ behavior: _etFast() ? 'auto' : 'smooth', block: 'center' }); } catch (e) {} });
}

// ── COIN ──────────────────────────────────────────────────────────────────
// evCoin(parent) -> { el, flip(side) -> Promise<side>, show(side), caption(t, cls) }
// side is 'heads' or 'tails'.
// r590 (owner: "more physics based, 3dish"): a disc with a rim (stacked edge
// layers), tossed under gravity, tumbling end over end on the X axis, landing
// on a shadow and bouncing twice with the spin damping onto the decided face.
const COIN_TILT = 16;                 // resting lean toward you, so the rim shows
const COIN_EDGE = 8;                  // edge layers (the coin's thickness in px)
function evCoin(parent) {
  const host = _etHost('evt-coin-host', parent);
  const edge = Array.from({ length: COIN_EDGE }, (_, i) =>
    `<i class="evt-edge" style="transform: translateZ(${(i - (COIN_EDGE - 1) / 2).toFixed(1)}px)"></i>`).join('');
  host.innerHTML = `<div class="evt-coin-stage"><div class="evt-coin-shadow"></div><div class="evt-coin-lift"><div class="evt-coin">${edge}
      <div class="evt-face evt-heads" style="transform: translateZ(${COIN_EDGE / 2}px)"><span>H</span></div>
      <div class="evt-face evt-tails" style="transform: rotateX(180deg) translateZ(${COIN_EDGE / 2}px)"><span>T</span></div>
    </div></div></div><div class="evt-coin-cap"></div>`;
  const coin = host.querySelector('.evt-coin'), lift = host.querySelector('.evt-coin-lift');
  const shadow = host.querySelector('.evt-coin-shadow'), cap = host.querySelector('.evt-coin-cap');
  let rest = 0;   // the face angle (0 heads, 180 tails), without the tilt
  const pose = (ang, y, yaw) => {
    coin.style.transform = `rotateY(${yaw || 0}deg) rotateX(${ang}deg)`;
    lift.style.transform = `translateY(${-y}px)`;
    const k = Math.max(0, 1 - y / 110);
    shadow.style.transform = `scale(${(0.45 + 0.55 * k).toFixed(3)}, ${(0.45 + 0.55 * k).toFixed(3)})`;
    shadow.style.opacity = (0.25 + 0.5 * k).toFixed(2);
  };
  const show = side => { rest = side === 'tails' ? 180 : 0; pose(rest - COIN_TILT, 0, 0); };
  show('heads');
  return {
    el: host,
    show,
    caption(t, cls) { cap.textContent = t || ''; cap.className = 'evt-coin-cap' + (cls ? ' ' + cls : ''); },
    flip(side) {
      const target = side === 'tails' ? 180 : 0;
      const from = rest - COIN_TILT;
      const turns = 4 + Math.floor(_etRnd() * 3);
      // Spin always forward; land exactly on the target face, tilted.
      let to = target - COIN_TILT + 360 * turns;
      while (to - from < 360 * turns) to += 360;
      const T = 0.95, H = 74 + _etRnd() * 14, v0 = 4 * H / T, g = 2 * v0 / T;   // flight: up and down in T
      const E = 0.36;                                                              // bounce restitution
      const b1 = 2 * v0 * E / g, b2 = 2 * v0 * E * E / g, settle = 0.42;
      const total = T + b1 + b2 + settle;
      const yawAmp = (_etRnd() - 0.5) * 34;
      cap.textContent = ''; cap.className = 'evt-coin-cap';
      _etSfx('sfxFlipShuffle');
      let hits = 0;
      return new Promise(res => {
        if (_etFast()) { rest = target; pose(target - COIN_TILT, 0, 0); _etSfx('sfxCoin'); return res(side); }
        const t0 = performance.now();
        const frame = now => {
          const t = Math.min(total, (now - t0) / 1000);
          let y = 0, ang, yaw = 0;
          if (t < T) {
            y = v0 * t - g * t * t / 2;
            const u = t / T;
            ang = from + (to - from - 40) * (1 - Math.pow(1 - u, 1.25));   // fast off the thumb, still turning at the catch
            yaw = yawAmp * Math.sin(u * Math.PI);
          } else {
            const tb = t - T;
            if (tb < b1) { const v = v0 * E; y = v * tb - g * tb * tb / 2; if (hits < 1) { hits = 1; _etSfx('sfxCoin'); } }
            else if (tb < b1 + b2) { const tt = tb - b1, v = v0 * E * E; y = v * tt - g * tt * tt / 2; if (hits < 2) { hits = 2; _etSfx('sfxClockTick'); } }
            else if (hits < 3) { hits = 3; _etSfx('sfxClockTick'); }
            // The last 40 degrees of spin damp out over the bounces and the settle.
            const d = tb / (total - T);
            ang = to - 40 * Math.exp(-5 * d) * Math.cos(d * Math.PI * 3.2) * (1 - d);
            yaw = yawAmp * 0.25 * Math.exp(-6 * d) * Math.sin(d * Math.PI * 4);
          }
          pose(ang, Math.max(0, y), yaw);
          if (t < total) { requestAnimationFrame(frame); return; }
          rest = target;
          pose(target - COIN_TILT, 0, 0);
          host.classList.remove('evt-land'); void host.offsetWidth; host.classList.add('evt-land');
          res(side);
        };
        requestAnimationFrame(frame);
      });
    },
  };
}

// ── WHEEL ───────────────────────────────────────────────────────────────────
// evWheel(segs, parent) where segs = [{ label, color, ink? }]
//   -> { el, spin(index) -> Promise<index> }
// A circle cut into equal slices under a fixed pointer at the top. It ticks as
// each slice boundary passes the pointer.
function evWheel(segs, parent, opts) {
  const o = opts || {};
  const host = _etHost('evt-wheel-host', parent);
  const n = segs.length, a = 360 / n;
  const stops = segs.map((s, i) => `${s.color} ${i * a}deg ${(i + 1) * a}deg`).join(', ');
  host.innerHTML = `<div class="evt-wheel-wrap"><div class="evt-pointer"></div>
      <div class="evt-wheel" style="background: conic-gradient(${stops})">${segs.map((s, i) =>
        `<div class="evt-wl" style="transform: rotate(${i * a + a / 2}deg)"><span style="color:${s.ink || '#120f1c'}">${s.label}</span></div>`).join('')}
      </div><div class="evt-hub"></div></div>${o.title ? `<div class="evt-wheel-title">${o.title}</div>` : ''}`;
  const wheel = host.querySelector('.evt-wheel');
  let angle = 0;
  return {
    el: host,
    spin(index) {
      const jitter = (_etRnd() - 0.5) * a * 0.6;
      const target = 360 * (4 + Math.floor(_etRnd() * 2)) + (360 - (index * a + a / 2)) + jitter;
      const start = angle % 360, end = start + target - (start % 360);
      let lastSlice = Math.floor(start / a);
      host.classList.remove('evt-won');
      return _etTween(o.ms || 2600, e => {
        angle = start + (end - start) * e;
        wheel.style.transform = `rotate(${angle}deg)`;
        const sl = Math.floor(angle / a);
        if (sl !== lastSlice) { lastSlice = sl; _etSfx('sfxClockTick'); }
      }).then(() => {
        host.dataset.won = index;
        host.classList.add('evt-won');
        _etSfx('sfxRewardReveal');
        return index;
      });
    },
  };
}

// ── DIE ─────────────────────────────────────────────────────────────────────
// evDie(faces, parent) -> { el, roll(value) -> Promise<value> }
// faces are numbers; a negative face is printed red.
function evDie(faces, parent, label) {
  const host = _etHost('evt-die-host', parent);
  host.innerHTML = `<div class="evt-die"><span></span></div><div class="evt-die-faces">${label ? `<b>${label}</b>` : ''}${faces.map(f =>
    `<i class="${f < 0 ? 'neg' : ''}">${f > 0 ? '+' + f : f}</i>`).join('')}</div>`;
  const die = host.querySelector('.evt-die'), face = die.querySelector('span');
  const paint = v => { face.textContent = v > 0 ? '+' + v : String(v); die.classList.toggle('neg', v < 0); };
  paint(faces[0]);
  return {
    el: host,
    roll(value) {
      host.classList.remove('evt-land');
      const flips = 11 + Math.floor(_etRnd() * 4);
      let k = 0;
      return new Promise(res => {
        const next = () => {
          if (k >= flips || _etFast()) {
            paint(value);
            die.style.transform = '';
            host.classList.remove('evt-land'); void host.offsetWidth; host.classList.add('evt-land');
            _etSfx('sfxCardPop');
            res(value); return;
          }
          paint(faces[Math.floor(_etRnd() * faces.length)]);
          die.style.transform = `rotate(${(_etRnd() - 0.5) * 50}deg) translateY(${-Math.sin(k / flips * Math.PI) * 18}px)`;
          if (k % 2 === 0) _etSfx('sfxClockTick');
          k++;
          setTimeout(next, 45 + k * k * 1.6);
        };
        next();
      });
    },
  };
}

// ── PLINKO ──────────────────────────────────────────────────────────────────
// evPlinko(bins, parent) where bins = [{ label, cls }]  (rows = bins - 1)
//   -> { el, offset(), drop(binIndex) -> Promise<binIndex> }
// The ball's path is built from the result: exactly `binIndex` rights among the
// rows, in a random order, so a bin's chance is the binomial share the player
// would expect from a real board.
// r590 (owner): half the speed, a bounce off every peg and two in the bin, and
// the ball can be slid PLINKO_SLIDE px either way before the drop (offset() is
// -1..1; evPlinkoRoll leans the odds that way, a little).
const PLINKO_SLIDE = 20, PLINKO_SEG_MS = 300, PLINKO_LEAN = 0.12;
function evPlinko(bins, parent) {
  const host = _etHost('evt-plinko-host', parent);
  const R = bins.length - 1, W = 300, binW = W / (R + 1), rowH = 26, top = 30;
  const H = top + (R + 1) * rowH + 8;
  let pegs = '';
  for (let k = 0; k < R; k++)
    for (let j = 0; j <= k; j++) {
      const x = W / 2 + (j - k / 2) * binW, y = top + (k + 1) * rowH - 6;
      pegs += `<i class="evt-peg" style="left:${x}px;top:${y}px"></i>`;
    }
  host.innerHTML = `<div class="evt-drop-hint">Slide the ball, then drop it</div><div class="evt-plinko" style="width:${W}px;height:${H + 34}px">${pegs}
      <div class="evt-drop-track" style="left:${W / 2 - PLINKO_SLIDE}px;width:${PLINKO_SLIDE * 2}px"></div>
      <div class="evt-ball evt-ball-drag" style="left:${W / 2}px;top:6px"></div>
      <div class="evt-bins" style="top:${H}px">${bins.map((b, i) =>
        `<div class="evt-bin ${b.cls || ''}" style="width:${binW}px" data-i="${i}">${b.label}</div>`).join('')}</div></div>`;
  const board = host.querySelector('.evt-plinko'), ball = host.querySelector('.evt-ball');
  let off = 0, armed = true;
  // Drag the ball along its track; the board is in stage px, the pointer in viewport px.
  ball.addEventListener('pointerdown', e => {
    if (!armed) return;
    e.preventDefault();
    const z = board.getBoundingClientRect().width / (board.offsetWidth || 1) || 1;
    const x0 = e.clientX, o0 = off;
    const move = ev => {
      off = Math.max(-1, Math.min(1, o0 + (ev.clientX - x0) / z / PLINKO_SLIDE));
      ball.style.left = (W / 2 + off * PLINKO_SLIDE) + 'px';
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  });
  return {
    el: host,
    offset: () => off,
    drop(binIndex) {
      armed = false;
      ball.classList.remove('evt-ball-drag');
      host.querySelector('.evt-drop-hint').style.visibility = 'hidden';
      const steps = Array.from({ length: R }, (_, i) => i < binIndex);
      for (let i = steps.length - 1; i > 0; i--) { const j = Math.floor(_etRnd() * (i + 1)); [steps[i], steps[j]] = [steps[j], steps[i]]; }
      const pts = [{ x: W / 2 + off * PLINKO_SLIDE, y: 6 }];
      let rights = 0;
      steps.forEach((right, k) => {
        if (right) rights++;
        pts.push({ x: W / 2 + (rights - (k + 1) / 2) * binW, y: top + (k + 1) * rowH - 14 });
      });
      const last = pts[pts.length - 1];
      pts.push({ x: last.x, y: H + 8 });
      host.querySelectorAll('.evt-bin').forEach(b => b.classList.remove('evt-hit'));
      const fast = _etFast();
      let p = Promise.resolve();
      pts.slice(1).forEach((pt, i) => {
        const from = pts[i], landing = i === pts.length - 2;
        const ms = fast ? 0 : (landing ? PLINKO_SEG_MS * 0.8 : PLINKO_SEG_MS);
        p = p.then(() => _etTween(ms, (e, t) => {
          // Each hop leaves the peg upward, then falls onto the next: a bounce.
          const x = from.x + (pt.x - from.x) * t;
          const y = from.y + (pt.y - from.y) * t * t - (landing ? 0 : Math.sin(Math.PI * t) * 10);
          ball.style.left = x + 'px'; ball.style.top = y + 'px';
        }, t => t).then(() => { if (!landing) _etSfx('sfxClockTick'); }));
      });
      // Two little hops in the bin.
      [9, 3].forEach(h => {
        p = p.then(() => _etTween(fast ? 0 : 150 + h * 10, (e, t) => {
          ball.style.top = (H + 8 - Math.sin(Math.PI * t) * h) + 'px';
        }, t => t));
      });
      return p.then(() => {
        const bin = host.querySelector(`.evt-bin[data-i="${binIndex}"]`);
        if (bin) bin.classList.add('evt-hit');
        _etSfx('sfxRewardReveal');
        return binIndex;
      });
    },
  };
}
// A bin index drawn with the board's own binomial odds, leaned by the drop point
// (off -1..1 moves each peg's right-hand chance by up to PLINKO_LEAN).
function evPlinkoRoll(bins, off) {
  const pr = 0.5 + PLINKO_LEAN * Math.max(-1, Math.min(1, off || 0));
  let b = 0;
  for (let k = 0; k < bins - 1; k++) if (Math.random() < pr) b++;
  return b;
}

// ── PATHS ── evGridPath(rows, cols): an order to visit every cell of a grid in,
// one of a few patterns (rows, snake, columns, spiral, diagonals), then turned,
// mirrored and maybe reversed at random, so it differs every time but always
// follows a pattern the eye can catch.
function evGridPath(rows, cols) {
  const at = [];
  const pats = [
    () => { for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) at.push([r, c]); },
    () => { for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) at.push([r, r % 2 ? cols - 1 - k : k]); },
    () => { for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) at.push([r, c]); },
    () => { for (let c = 0; c < cols; c++) for (let k = 0; k < rows; k++) at.push([c % 2 ? rows - 1 - k : k, c]); },
    () => { let t = 0, b = rows - 1, l = 0, rr = cols - 1;
            while (t <= b && l <= rr) {
              for (let c = l; c <= rr; c++) at.push([t, c]); t++;
              for (let r = t; r <= b; r++) at.push([r, rr]); rr--;
              if (t <= b) { for (let c = rr; c >= l; c--) at.push([b, c]); b--; }
              if (l <= rr) { for (let r = b; r >= t; r--) at.push([r, l]); l++; } } },
    () => { for (let d = 0; d < rows + cols - 1; d++) { const line = [];
              for (let r = 0; r < rows; r++) { const c = d - r; if (c >= 0 && c < cols) line.push([r, c]); }
              at.push(...(d % 2 ? line.reverse() : line)); } },
  ];
  pats[Math.floor(_etRnd() * pats.length)]();
  const sq = rows === cols, turn = sq ? Math.floor(_etRnd() * 4) : 2 * Math.floor(_etRnd() * 2), flip = _etRnd() < 0.5;
  let out = at.map(([r, c]) => {
    for (let k = 0; k < turn; k++) [r, c] = sq ? [c, rows - 1 - r] : [rows - 1 - r, cols - 1 - c];
    if (flip) c = cols - 1 - c;
    return r * cols + c;
  });
  if (_etRnd() < 0.5) out = out.reverse();
  return out;
}

// ── STOPPER ─────────────────────────────────────────────────────────────────
// evStopper(items, parent, opts) where items = [html]
//   -> Promise<index>, resolved on the player's tap (the grid or STOP).
// The highlight runs in reading order at opts.stepMs: fast enough to be mostly
// luck, regular enough that a sharp eye can aim.
function evStopper(items, parent, opts) {
  const o = opts || {};
  const cols = o.cols || 3;
  const host = _etHost('evt-stop-host evt-cols' + cols, parent);
  host.innerHTML = `<div class="evt-stop-grid" style="grid-template-columns:repeat(${cols}, 1fr)">${items.map((h, i) =>
    `<div class="evt-stop-cell" data-i="${i}">${h}</div>`).join('')}</div>
    <button class="ev-btn evt-stop-btn" type="button">${o.label || 'STOP'}</button>`;
  const cells = [...host.querySelectorAll('.evt-stop-cell')];
  // r590: the light may follow a given path (o.order, cell indices) instead of reading order.
  const path = (o.order && o.order.length === cells.length) ? o.order : cells.map((_, k) => k);
  let p = Math.floor(_etRnd() * path.length), i = path[p], done = false, timer = null;
  const paint = () => cells.forEach((c, k) => c.classList.toggle('lit', k === i));
  paint();
  return new Promise(res => {
    const tick = () => {
      if (done) return;
      p = (p + 1) % path.length; i = path[p]; paint();
      if (p % 3 === 0) _etSfx('sfxClockTick');
      timer = setTimeout(tick, o.stepMs || 62);
    };
    timer = setTimeout(tick, o.stepMs || 62);
    const stop = () => {
      if (done) return;
      done = true; clearTimeout(timer);
      cells[i].classList.add('won');
      host.classList.add('evt-stopped');
      host.querySelector('.evt-stop-btn').disabled = true;
      _etSfx('sfxRewardReveal');
      res(i);
    };
    host.querySelector('.evt-stop-btn').addEventListener('click', stop);
    host.querySelector('.evt-stop-grid').addEventListener('click', stop);
  });
}
