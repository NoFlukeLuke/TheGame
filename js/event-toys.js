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

// ── COIN ────────────────────────────────────────────────────────────────────
// evCoin(parent) -> { el, flip(side) -> Promise<side>, show(side) }
// side is 'heads' or 'tails'.
function evCoin(parent) {
  const host = _etHost('evt-coin-host', parent);
  host.innerHTML = `<div class="evt-coin-stage"><div class="evt-coin">
      <div class="evt-face evt-heads"><span>H</span></div>
      <div class="evt-face evt-tails"><span>T</span></div>
    </div></div><div class="evt-coin-cap"></div>`;
  const coin = host.querySelector('.evt-coin'), cap = host.querySelector('.evt-coin-cap');
  let rest = 0;
  const show = side => { rest = side === 'tails' ? 180 : 0; coin.style.transform = `rotateY(${rest}deg)`; };
  return {
    el: host,
    show,
    caption(t, cls) { cap.textContent = t || ''; cap.className = 'evt-coin-cap' + (cls ? ' ' + cls : ''); },
    flip(side) {
      const turns = 4 + Math.floor(_etRnd() * 3);
      const end = rest + turns * 360 + (((side === 'tails' ? 180 : 0) - rest) % 360 + 360) % 360;
      const start = rest;
      cap.textContent = ''; cap.className = 'evt-coin-cap';
      _etSfx('sfxFlipShuffle');
      return _etTween(1400, (e, t) => {
        const a = start + (end - start) * e;
        const lift = Math.sin(Math.PI * t) * 46;
        coin.style.transform = `translateY(${-lift}px) rotateY(${a}deg)`;
      }).then(() => {
        rest = end % 360;
        coin.style.transform = `rotateY(${rest}deg)`;
        host.classList.remove('evt-land'); void host.offsetWidth; host.classList.add('evt-land');
        _etSfx('sfxCoin');
        return side;
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
function evDie(faces, parent) {
  const host = _etHost('evt-die-host', parent);
  host.innerHTML = `<div class="evt-die"><span></span></div><div class="evt-die-faces">${faces.map(f =>
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
//   -> { el, drop(binIndex) -> Promise<binIndex> }
// The ball's path is built from the result: exactly `binIndex` rights among the
// rows, in a random order, so a bin's chance is the binomial share the player
// would expect from a real board.
function evPlinko(bins, parent) {
  const host = _etHost('evt-plinko-host', parent);
  const R = bins.length - 1, W = 300, binW = W / (R + 1), rowH = 26, top = 18;
  const H = top + (R + 1) * rowH + 8;
  let pegs = '';
  for (let k = 0; k < R; k++)
    for (let j = 0; j <= k; j++) {
      const x = W / 2 + (j - k / 2) * binW, y = top + (k + 1) * rowH - 6;
      pegs += `<i class="evt-peg" style="left:${x}px;top:${y}px"></i>`;
    }
  host.innerHTML = `<div class="evt-plinko" style="width:${W}px;height:${H + 34}px">${pegs}
      <div class="evt-ball" style="left:${W / 2}px;top:0"></div>
      <div class="evt-bins" style="top:${H}px">${bins.map((b, i) =>
        `<div class="evt-bin ${b.cls || ''}" style="width:${binW}px" data-i="${i}">${b.label}</div>`).join('')}</div></div>`;
  const ball = host.querySelector('.evt-ball');
  return {
    el: host,
    drop(binIndex) {
      const steps = Array.from({ length: R }, (_, i) => i < binIndex);
      for (let i = steps.length - 1; i > 0; i--) { const j = Math.floor(_etRnd() * (i + 1)); [steps[i], steps[j]] = [steps[j], steps[i]]; }
      const pts = [{ x: W / 2, y: 0 }];
      let rights = 0;
      steps.forEach((right, k) => {
        if (right) rights++;
        pts.push({ x: W / 2 + (rights - (k + 1) / 2) * binW, y: top + (k + 1) * rowH - 14 });
      });
      pts.push({ x: pts[pts.length - 1].x, y: H + 8 });
      host.querySelectorAll('.evt-bin').forEach(b => b.classList.remove('evt-hit'));
      const seg = _etFast() ? 0 : 150;
      let p = Promise.resolve();
      pts.slice(1).forEach((pt, i) => {
        const from = pts[i];
        p = p.then(() => _etTween(seg, (e, t) => {
          const x = from.x + (pt.x - from.x) * t;
          const y = from.y + (pt.y - from.y) * t - Math.sin(Math.PI * t) * 7;
          ball.style.left = x + 'px'; ball.style.top = y + 'px';
        }, t => t).then(() => { if (i < pts.length - 2) _etSfx('sfxClockTick'); }));
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
// A bin index drawn with the board's own binomial odds.
function evPlinkoRoll(bins) {
  let b = 0;
  for (let k = 0; k < bins - 1; k++) if (Math.random() < 0.5) b++;
  return b;
}

// ── STOPPER ─────────────────────────────────────────────────────────────────
// evStopper(items, parent, opts) where items = [html]
//   -> Promise<index>, resolved on the player's tap (the grid or STOP).
// The highlight runs in reading order at opts.stepMs: fast enough to be mostly
// luck, regular enough that a sharp eye can aim.
function evStopper(items, parent, opts) {
  const o = opts || {};
  const host = _etHost('evt-stop-host', parent);
  const cols = o.cols || 3;
  host.innerHTML = `<div class="evt-stop-grid" style="grid-template-columns:repeat(${cols}, 1fr)">${items.map((h, i) =>
    `<div class="evt-stop-cell" data-i="${i}">${h}</div>`).join('')}</div>
    <button class="ev-btn evt-stop-btn" type="button">${o.label || 'STOP'}</button>`;
  const cells = [...host.querySelectorAll('.evt-stop-cell')];
  let i = Math.floor(_etRnd() * cells.length), done = false, timer = null;
  const paint = () => cells.forEach((c, k) => c.classList.toggle('lit', k === i));
  paint();
  return new Promise(res => {
    const tick = () => {
      if (done) return;
      i = (i + 1) % cells.length; paint();
      if (i % 3 === 0) _etSfx('sfxClockTick');
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
