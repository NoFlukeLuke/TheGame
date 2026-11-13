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
// layers) over its shadow. r744: thrown by coinSimulate (js/coin-sim.js).
// r763 (owner): it is thrown on a TABLE seen from above at an angle. The table
// is a plane turned back COIN_TABLE_TILT degrees in its own perspective; the
// coin and its shadow live in the table's plane, so "up" is off the felt
// (translateZ), the sim's depth runs down the table toward you (local y) and
// its turn is end over end about the table's x axis. A flat coin is a flat div.
const COIN_TABLE_TILT = 50;           // degrees the table leans back from facing you
const COIN_EDGE = 8;                  // edge layers (the coin's thickness in px)
function evCoin(parent) {
  const host = _etHost('evt-coin-host', parent);
  const edge = Array.from({ length: COIN_EDGE }, (_, i) =>
    `<i class="evt-edge" style="transform: translateZ(${(i - (COIN_EDGE - 1) / 2).toFixed(1)}px)"></i>`).join('');
  host.innerHTML = `<div class="evt-coin-stage"><div class="evt-coin-table" style="transform: rotateX(${COIN_TABLE_TILT}deg)">
      <i class="evt-coin-felt"></i><i class="evt-coin-front"></i>
      <div class="evt-coin-shadow"></div><div class="evt-coin-lift"><div class="evt-coin">${edge}
      <div class="evt-face evt-heads" style="transform: translateZ(${COIN_EDGE / 2}px)"><span>H</span></div>
      <div class="evt-face evt-tails" style="transform: rotateX(180deg) translateZ(${COIN_EDGE / 2}px)"><span>T</span></div>
    </div></div></div></div><div class="evt-coin-cap"></div>`;
  const coin = host.querySelector('.evt-coin'), lift = host.querySelector('.evt-coin-lift');
  const shadow = host.querySelector('.evt-coin-shadow'), cap = host.querySelector('.evt-coin-cap');
  if (typeof coinSoundsWarm === 'function') coinSoundsWarm();
  let rest = 'heads';
  // f: one frame of coinSimulate (js/coin-sim.js). th turns it end over end, wx / wy
  // tilt it as it settles, yaw spins it on the felt; y lifts it off the table, z
  // runs down the table toward you, x across it.
  const D = 180 / Math.PI;
  const pose = f => {
    lift.style.transform = `translate3d(${f.x.toFixed(2)}px, ${f.z.toFixed(2)}px, ${(f.y + COIN_EDGE / 2).toFixed(2)}px)`;
    coin.style.transform = `rotateZ(${(f.yaw * D).toFixed(2)}deg) rotateX(${((f.th + f.wx) * D).toFixed(2)}deg) rotateY(${(f.wy * D).toFixed(2)}deg)`;
    const k = Math.max(0, 1 - f.y / 120);
    shadow.style.transform = `translate(${(f.x + f.y * 0.18).toFixed(2)}px, ${(f.z + f.y * 0.12).toFixed(2)}px) scale(${(0.55 + 0.45 * k).toFixed(3)})`;
    shadow.style.opacity = (0.2 + 0.6 * k).toFixed(2);
  };
  const flatPose = side => ({ y: 0, z: 0, x: 0, th: side === 'tails' ? Math.PI : 0, yaw: 0, wx: 0, wy: 0 });
  const show = side => { rest = side === 'tails' ? 'tails' : 'heads'; pose(flatPose(rest)); };
  show('heads');
  return {
    el: host,
    show,
    caption(t, cls) { cap.textContent = t || ''; cap.className = 'evt-coin-cap' + (cls ? ' ' + cls : ''); },
    // r744 (owner): a real throw. coinThrowFor simulates throws until one lands on
    // `side`; the sounds fire at the sim's own contacts.
    flip(side) {
      cap.textContent = ''; cap.className = 'evt-coin-cap';
      return new Promise(res => {
        if (_etFast()) { show(side); _etSfx('sfxCoinHit', 0.8); return res(side); }
        const sim = coinThrowFor(side, rest), F = sim.frames, n = F.length;
        let hit = 0, settled = false;
        const end = F[n - 1], air = Math.max(0.2, sim.hits.length ? sim.hits[0].t : 0.6);
        _etSfx('sfxCoinFlick');
        const t0 = performance.now();
        const frame = now => {
          const t = Math.max(0, (now - t0) / 1000);
          const i = Math.min(n - 1, Math.floor(t * 60));
          while (hit < sim.hits.length && sim.hits[hit].t <= t) _etSfx('sfxCoinHit', sim.hits[hit++].k);
          if (!settled && t >= sim.settleAt && hit >= sim.hits.length) { settled = true; _etSfx('sfxCoinSettle'); }
          // The sim's drift (x sideways, z depth) is undone while the coin is in the
          // air, so it comes to rest where it rests between flips.
          const fr = F[i], u = Math.min(1, t / air), e = 1 - u * u * (3 - 2 * u);
          pose({ ...fr, x: fr.x - end.x * (1 - e), z: fr.z - end.z * (1 - e) });
          if (i < n - 1 && !_etFast()) { requestAnimationFrame(frame); return; }
          show(side);
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
// faces are six numbers; a negative face is a red die (js/dice-sim.js).
// r743 (owner): a real throw. The die is a cube tossed across a small table by
// diceSimulate and comes to rest on the decided face.
function evDie(faces, parent, label) {
  const host = _etHost('evt-die-host', parent);
  host.innerHTML = `<div class="evt-die-tray"></div><div class="evt-die-faces">${label ? `<b>${label}</b>` : ''}${faces.map(f =>
    `<i class="${f < 0 ? 'neg' : ''}">${f > 0 ? '+' + f : f}</i>`).join('')}</div>`;
  const tray = host.querySelector('.evt-die-tray');
  const die = diceMake(tray, faces, { size: 40 });
  requestAnimationFrame(() => die.show(faces[0]));
  return {
    el: host,
    roll(value) {
      host.classList.remove('evt-land');
      // Thrown in from the left edge, across the table.
      return die.roll(value, { x: 30, y: 34 + _etRnd() * 32, h: 30, dir: (_etRnd() - 0.5) * 0.9 }).then(v => {
        _etSfx('sfxCardPop');
        return v;
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
// r590 (owner): the ball can be slid PLINKO_SLIDE px either way before the drop
// (offset() is -1..1; evPlinkoRoll leans the odds that way, a little). The flight
// itself is plinkoRoute / plinkoPlay (r742).
const PLINKO_SLIDE = 20, PLINKO_LEAN = 0.12;
// r764 (owner): everything bigger. The board is as wide as the event body allows up
// to PLINKO_MAX_W, and every size (rows, pegs, ball, slide) scales with it (plS).
const PLINKO_MAX_W = 380;
let plS = 1;
function evPlinko(bins, parent) {
  const host = _etHost('evt-plinko-host', parent);
  const bodyEl = document.getElementById('event-body');
  const R = bins.length - 1;
  let W, binW, rowH, top, H, SL, board, ball, off = 0, armed = true;
  // Lay the board out at width w. The event body can still be hidden when the
  // board is built (width 0); then it is laid out again at the real width on the
  // next frames, before the ball can be dropped.
  const roomNow = () => Math.max((parent && parent.clientWidth) || 0, (bodyEl && bodyEl.clientWidth) || 0) - 12;
  const layout = w => {
    W = Math.max(300, Math.min(PLINKO_MAX_W, w)); plS = W / 300;
    host.style.setProperty('--pl-s', plS.toFixed(3));
    binW = W / (R + 1); rowH = 26 * plS; top = 30 * plS; SL = PLINKO_SLIDE * plS;
    H = top + (R + 1) * rowH + 8;
    let pegs = '';
    for (let k = 0; k < R; k++)
      for (let j = 0; j <= k; j++) {
        const x = W / 2 + (j - k / 2) * binW, y = top + (k + 1) * rowH - 6 * plS;
        pegs += `<i class="evt-peg" style="left:${x}px;top:${y}px"></i>`;
      }
    host.innerHTML = `<div class="evt-drop-hint">Slide the ball, then drop it</div><div class="evt-plinko" style="width:${W}px;height:${H + 34 * plS}px">${pegs}
      <div class="evt-drop-track" style="left:${W / 2 - SL}px;width:${SL * 2}px"></div>
      <div class="evt-ball evt-ball-drag" style="left:${W / 2 + off * SL}px;top:6px"></div>
      <div class="evt-bins" style="top:${H}px">${bins.map((b, i) =>
        `<div class="evt-bin ${b.cls || ''}" style="width:${binW}px" data-i="${i}">${b.label}</div>`).join('')}</div></div>`;
    board = host.querySelector('.evt-plinko'); ball = host.querySelector('.evt-ball');
    // Drag the ball along its track; the board is in stage px, the pointer in viewport px.
    ball.addEventListener('pointerdown', e => {
      if (!armed) return;
      e.preventDefault();
      const z = board.getBoundingClientRect().width / (board.offsetWidth || 1) || 1;
      const x0 = e.clientX, o0 = off;
      const move = ev => {
        off = Math.max(-1, Math.min(1, o0 + (ev.clientX - x0) / z / SL));
        ball.style.left = (W / 2 + off * SL) + 'px';
      };
      const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    });
  };
  layout(roomNow() > 0 ? roomNow() : 300);
  let tries = 0;
  const refit = () => {
    if (!armed || !host.isConnected) return;
    const r = roomNow();
    if (r > 0) { if (Math.abs(Math.min(PLINKO_MAX_W, Math.max(300, r)) - W) > 1) layout(r); return; }
    if (++tries < 30) requestAnimationFrame(refit);
  };
  requestAnimationFrame(refit);
  return {
    el: host,
    offset: () => off,
    drop(binIndex) {
      armed = false;
      ball.classList.remove('evt-ball-drag');
      host.querySelector('.evt-drop-hint').style.visibility = 'hidden';
      host.querySelectorAll('.evt-bin').forEach(b => b.classList.remove('evt-hit'));
      const route = plinkoRoute(R, W, binW, rowH, top, H, binIndex, off, pegEl);
      const done = () => {
        const bin = host.querySelector(`.evt-bin[data-i="${binIndex}"]`);
        if (bin) bin.classList.add('evt-hit');
        _etSfx('sfxRewardReveal');
        return binIndex;
      };
      const place = (x, y) => { ball.style.left = x + 'px'; ball.style.top = (y - PL_BR * plS) + 'px'; };
      if (_etFast()) { const e = route.end; place(e.x, e.y); ball.style.transform = ''; return Promise.resolve(done()); }
      return plinkoPlay(route, place, ball).then(done);
    },
  };
  function pegEl(k, j) { return board.querySelectorAll('.evt-peg')[k * (k + 1) / 2 + j]; }
}
// r742 (owner): the drop is real gravity. The ball falls from rest (no hop off
// the drop point), strikes each peg on the shoulder it leaves by, and rebounds
// with a share of the speed it hit with, so bounces come from the fall and not a
// fixed arc. Each hit squashes the ball along the strike, kicks the peg and
// plinks (louder when it hits harder, higher down the board). In the bin it
// rattles off the floor and the walls until it settles. The path still lands on
// the bin the roll chose; the physics only shape the trip.
const PL_G = 0.0016;              // gravity, px per ms^2 at plS 1 (a hop between rows ~0.3s);
                                  // r764: x plS / 1.1, so a bigger board drops only a touch slower
const PL_BR = 7, PL_PR = 3;       // ball and peg radius, px (css/event-toys.css)
const PL_E = [0.40, 0.56];        // a peg's bounce: share of the strike speed kept
const PL_FLOOR_E = 0.42, PL_FLOOR_F = 0.55; // the bin floor's bounce, and sideways speed kept
const PL_SQUASH = 0.28, PL_SQUASH_MS = 70;  // most squash at the hardest hit, and its decay
// Every flight is a parabola: seg = { x, y, vx, vy, ms, lo, hi } (vy < 0 is up);
// an impact at its end carries { peg, nx, ny, hit } for the squash and the sound.
function plinkoRoute(R, W, binW, rowH, top, H, binIndex, off, pegEl) {
  const rnd = (a, b) => a + (b - a) * _etRnd();
  const steps = Array.from({ length: R }, (_, i) => i < binIndex);
  for (let i = steps.length - 1; i > 0; i--) { const j = Math.floor(_etRnd() * (i + 1)); [steps[i], steps[j]] = [steps[j], steps[i]]; }
  const S = plS, G = PL_G * S / 1.1, BR = PL_BR * S, CD = (PL_BR + PL_PR) * S;
  const x0 = W / 2 + off * PLINKO_SLIDE * S, y0 = 6 + BR, lean = x0 - W / 2;
  // The first strike goes the way the ball was slid: put a step that way first.
  if (Math.abs(lean) > 1.5 && steps[0] !== (lean > 0)) {
    const i = steps.findIndex(r => r === (lean > 0));
    if (i > 0) [steps[0], steps[i]] = [steps[i], steps[0]];
  }
  // Slid well off the top peg, the ball misses it and falls onto the next row.
  const skip = R > 1 && Math.abs(lean) > CD * 0.7 && steps[0] === (lean > 0);
  // r764 (owner: "the direction the ball goes makes more sense"). The side a peg is
  // struck on is the side the ball leaves by, and how far round the shoulder
  // follows from where the ball comes from: carrying on the way it was going it
  // clips the peg just past the top (a glance); turning back it meets the
  // shoulder facing it, further round (a real knock), so it never passes over
  // a peg to strike its far side.
  const contacts = [];
  let j = 0, dir = 0;
  for (let k = 0; k < R; k++) {
    const side = steps[k] ? 1 : -1;
    if (!(skip && k === 0)) {
      const px = W / 2 + (j - k / 2) * binW, py = top + (k + 1) * rowH - 6 * S;
      const s = !contacts.length ? Math.max(1, Math.min(7 * S, side * (x0 - px)))
        : (dir === side ? rnd(0.6, 2.2) : rnd(3, 6.5)) * S;
      const dy = Math.sqrt(Math.max(1, CD * CD - s * s));
      contacts.push({ x: px + side * s, y: py - dy, peg: pegEl(k, j), nx: side * s / CD, ny: -dy / CD, k, turn: dir && dir !== side });
    }
    dir = side;
    if (steps[k]) j++;
  }
  const segs = [];
  let px = x0, py = y0, up = 0, vyIn = 0;
  const fly = (to, extra) => {
    const t = (up + Math.sqrt(up * up + 2 * G * (to.y - py))) / G;
    const seg = { x: px, y: py, vx: (to.x - px) / t, vy: -up, ms: t, g: G, ...extra };
    segs.push(seg);
    vyIn = -up + G * t; px = to.x; py = to.y;
    return seg;
  };
  const vMax = Math.sqrt(2 * G * rowH * 2.2);
  contacts.forEach(c => {
    fly(c, { peg: c.peg, nx: c.nx, ny: c.ny, k: c.k });
    segs[segs.length - 1].hit = Math.min(1, vyIn / vMax);
    // The rebound comes off the surface: a knock on the shoulder throws the ball up
    // less than a glance near the top (the normal's upward share), within PL_E.
    up = vyIn * rnd(PL_E[0], PL_E[1]) * (c.turn ? 0.85 + 0.15 * -c.ny : 1);
  });
  // Into the bin, then rattle on the floor and off the walls until it rests.
  const bx = W / 2 + (binIndex - R / 2) * binW, fy = H + 8 + BR;
  const lo = bx - binW / 2 + BR + 1, hi = bx + binW / 2 - BR - 1;
  const inSeg = fly({ x: bx + rnd(-2, 2), y: fy }, { floor: true, k: R });
  inSeg.hit = Math.min(1, vyIn / vMax);
  let vx = inSeg.vx * PL_FLOOR_F;
  up = vyIn * PL_FLOOR_E;
  while (up * up / (2 * G) > 0.4) {
    const t = 2 * up / G;
    const seg = { x: px, y: py, vx, vy: -up, ms: t, g: G, lo, hi, floor: true, hit: Math.min(1, up / vMax), k: R };
    segs.push(seg);
    const e = plinkoFold(px + vx * t, lo, hi);
    px = e.x; if (e.flip) vx = -vx;
    vx *= PL_FLOOR_F; up *= PL_FLOOR_E;
  }
  return { segs, end: { x: px, y: py } };
}
// A position inside [lo, hi], bounced off the walls (and whether it ended going back).
function plinkoFold(x, lo, hi) {
  const w = hi - lo; if (w <= 0) return { x: lo, flip: false };
  let u = (x - lo) % (2 * w); if (u < 0) u += 2 * w;
  return u > w ? { x: hi - (u - w), flip: true } : { x: lo + u, flip: false };
}
function plinkoPlay(route, place, ball) {
  return new Promise(res => {
    const segs = route.segs;
    let i = 0, t0 = performance.now(), sq = null;
    const squash = (seg, now) => { sq = { a: PL_SQUASH * (0.35 + 0.65 * seg.hit), nx: seg.floor ? 0 : seg.nx, ny: seg.floor ? -1 : seg.ny, at: now }; };
    const impact = (seg, now) => {
      squash(seg, now);
      if (seg.peg) { seg.peg.classList.remove('evt-peg-hit'); void seg.peg.offsetWidth; seg.peg.classList.add('evt-peg-hit'); }
      _etSfx('sfxPlinkoHit', seg.hit, seg.k, !!seg.floor);
    };
    const frame = now => {
      while (i < segs.length && now - t0 >= segs[i].ms) { t0 += segs[i].ms; impact(segs[i], t0); i++; }
      if (i >= segs.length) { place(route.end.x, route.end.y); ball.style.transform = ''; res(); return; }
      const s = segs[i], t = now - t0;
      let x = s.x + s.vx * t;
      if (s.lo != null) x = plinkoFold(x, s.lo, s.hi).x;
      place(x, s.y + s.vy * t + 0.5 * (s.g || PL_G) * t * t);
      if (sq) {
        const a = sq.a * Math.exp(-(now - sq.at) / PL_SQUASH_MS);
        if (a < 0.01) { sq = null; ball.style.transform = ''; }
        else {
          const deg = Math.atan2(sq.ny, sq.nx) * 180 / Math.PI;
          ball.style.transform = `rotate(${deg}deg) scale(${1 - a}, ${1 + a * 0.7}) rotate(${-deg}deg)`;
        }
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}
// The ball on a peg (or the bin floor): a short plink, louder for a harder hit,
// a step higher each row down; the floor is a duller tap.
function sfxPlinkoHit(hit, row, floor) {
  if (typeof getAudioCtx !== 'function' || typeof sfxOut !== 'function') return;
  const v = (typeof sfxVolume === 'function') ? sfxVolume() : 1; if (v <= 0) return;
  const ctx = getAudioCtx(), t = ctx.currentTime, g0 = (0.25 + 0.75 * (hit || 0)) * v;
  const f = floor ? 520 : 1250 * Math.pow(1.06, row || 0) * (0.97 + 0.06 * _etRnd());
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = floor ? 'triangle' : 'sine';
  o.frequency.setValueAtTime(f * 1.04, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.02);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime((floor ? 0.07 : 0.05) * g0, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + (floor ? 0.06 : 0.11));
  o.connect(g).connect(sfxOut(ctx)); o.start(t); o.stop(t + 0.13);
  const n = Math.max(1, Math.floor(ctx.sampleRate * 0.006)), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  for (let k = 0; k < n; k++) d[k] = (_etRnd() * 2 - 1) * Math.pow(1 - k / n, 2);
  const s = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), ng = ctx.createGain();
  s.buffer = b; bp.type = 'bandpass'; bp.frequency.value = floor ? 1800 : 3600; bp.Q.value = 2;
  ng.gain.value = 0.06 * g0;
  s.connect(bp).connect(ng).connect(sfxOut(ctx)); s.start(t);
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
