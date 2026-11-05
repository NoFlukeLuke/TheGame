// ── DICE (r743) ─────────────────────────────────────────────────────────────
//
// A die you can watch land. A CSS cube with Kenney's die faces (assets/dice/,
// CC0) is thrown by a small physics sim: gravity, bounces off the table and
// the tray's walls, sliding friction, a spin that turns into rolling on every
// touch, and a settle that tips it flat onto its nearest face.
//
// THE RESULT IS DECIDED FIRST (js/event-toys.js's rule). The throw is
// simulated to the end before anything moves; whichever face it comes to rest
// on, the die is turned at the START by the one cube rotation that puts the
// decided face there. So the flight is pure physics and the last frame is the
// result, with no correction you could see.
//
// Faces are numbers: |v| 1 to 6 draws that many pips, white for a positive face
// and red for a negative one; anything else prints the number on the face.
// Cosmetic randomness is fxRandom (a seeded run's draws are not moved).
//
//   diceMake(tray, faces, opts) -> { el, show(value), roll(value) -> Promise }
//     tray: an element with a size (the table); faces: six values.
//   diceThrowAt(rect, faces, value, opts) -> Promise
//     a body-level throw over a viewport rect (the D6 Trick's chip).

const DICE_CFG = {
  size: 40,          // die edge, px in the tray's own units
  g: 2600,           // gravity, px/s^2 (scaled by size / 40)
  rest: 0.38,        // table bounce
  wall: 0.55,        // wall bounce
  slide: 900,        // sliding friction, px/s^2
  maxMs: 2600,       // a throw never runs longer
  hz: 240,           // sim steps a second
};

// The six face slots, by outward normal (CSS axes: x right, y down, z toward you).
const DICE_SLOTS = [[0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]];
// A real die's opposite faces add to 7: put faces[i] and faces[5 - i] on opposite slots.
const DICE_SLOT_OF = [0, 2, 4, 5, 3, 1];

function _dRnd() { return (typeof fxRandom === 'function') ? fxRandom() : Math.random(); }
function _dFast() {
  return document.body.classList.contains('reduced-motion') ||
    (typeof SETTINGS === 'object' && SETTINGS && SETTINGS.reducedMotion);
}

// ── quaternions [w, x, y, z] ──
function _qMul(a, b) {
  return [a[0]*b[0] - a[1]*b[1] - a[2]*b[2] - a[3]*b[3],
          a[0]*b[1] + a[1]*b[0] + a[2]*b[3] - a[3]*b[2],
          a[0]*b[2] - a[1]*b[3] + a[2]*b[0] + a[3]*b[1],
          a[0]*b[3] + a[1]*b[2] - a[2]*b[1] + a[3]*b[0]];
}
function _qNorm(q) { const n = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return q.map(v => v / n); }
function _qAxis(ax, ang) { const s = Math.sin(ang / 2), n = Math.hypot(...ax) || 1; return [Math.cos(ang / 2), ax[0]/n*s, ax[1]/n*s, ax[2]/n*s]; }
function _qRot(q, v) {
  const p = _qMul(_qMul(q, [0, v[0], v[1], v[2]]), [q[0], -q[1], -q[2], -q[3]]);
  return [p[1], p[2], p[3]];
}
function _qSlerp(a, b, t) {
  let d = a[0]*b[0] + a[1]*b[1] + a[2]*b[2] + a[3]*b[3];
  if (d < 0) { b = b.map(v => -v); d = -d; }
  if (d > 0.9995) return _qNorm(a.map((v, i) => v + (b[i] - v) * t));
  const th = Math.acos(d), s = Math.sin(th);
  return a.map((v, i) => (v * Math.sin((1 - t) * th) + b[i] * Math.sin(t * th)) / s);
}
function _qRandom() {
  const u = _dRnd(), v = _dRnd(), w = _dRnd();
  return [Math.sqrt(1 - u) * Math.sin(2 * Math.PI * v), Math.sqrt(1 - u) * Math.cos(2 * Math.PI * v),
          Math.sqrt(u) * Math.sin(2 * Math.PI * w), Math.sqrt(u) * Math.cos(2 * Math.PI * w)];
}
function _qMatrix(q, t) {
  const [w, x, y, z] = q;
  const m = [1 - 2*(y*y + z*z), 2*(x*y - w*z), 2*(x*z + w*y),
             2*(x*y + w*z), 1 - 2*(x*x + z*z), 2*(y*z - w*x),
             2*(x*z - w*y), 2*(y*z + w*x), 1 - 2*(x*x + y*y)];
  // matrix3d is column-major
  return `matrix3d(${m[0]},${m[3]},${m[6]},0,${m[1]},${m[4]},${m[7]},0,${m[2]},${m[5]},${m[8]},0,${t[0]},${t[1]},${t[2]},1)`;
}
// The rotation taking unit vector a onto unit vector b (180 degrees about a perpendicular when opposite).
function _qArc(a, b) {
  const d = a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
  if (d > 0.9999) return [1, 0, 0, 0];
  if (d < -0.9999) { const p = Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]; return _qAxis(_cross(a, p), Math.PI); }
  return _qAxis(_cross(a, b), Math.acos(d));
}
function _cross(a, b) { return [a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]]; }
// The face slot pointing most toward you.
function _dUpSlot(q) {
  let best = 0, bz = -2;
  DICE_SLOTS.forEach((n, i) => { const z = _qRot(q, n)[2]; if (z > bz) { bz = z; best = i; } });
  return best;
}

// ── the sim ──
// Returns frames [{ x, y, h, q }] at 60 a second, from a state { x, y, h, q }
// inside a W x H table. Everything is in the tray's px.
function diceSimulate(W, H, s, from) {
  const k = s / 40, g = DICE_CFG.g * k, dt = 1 / DICE_CFG.hz, r = s / 2;
  let x = from.x, y = from.y, h = from.h || 0, q = from.q;
  // A toss: up off the table, across toward the far side, spinning hard.
  const ang = (from.dir != null ? from.dir : _dRnd() * Math.PI * 2);
  const sp = (from.speed || (W * 1.5 + _dRnd() * W * 0.8));
  let vx = Math.cos(ang) * sp, vy = Math.sin(ang) * sp * 0.6, vh = (from.lift || (320 + _dRnd() * 160)) * k;
  let w = [(_dRnd() - 0.5) * 34, (_dRnd() - 0.5) * 34, (_dRnd() - 0.5) * 14];
  const frames = [];
  let t = 0, still = 0, acc = 0;
  const e = s * 0.72;   // walls stop the die's half diagonal, so a die turned 45 degrees stays inside
  const minX = e, maxX = Math.max(e, W - e), minY = e, maxY = Math.max(e, H - e);
  while (t < DICE_CFG.maxMs / 1000) {
    vh -= g * dt;
    h += vh * dt;
    let ground = false;
    if (h <= 0) {
      h = 0; ground = true;
      if (vh < -60 * k) {
        // A hit: bounce, lose some slide, and the spin turns toward rolling.
        vh = -vh * DICE_CFG.rest;
        vx *= 0.78; vy *= 0.78;
        const roll = [-vy / r, vx / r, w[2] * 0.6];
        w = w.map((v, i) => v * 0.45 + roll[i] * 0.55 + (_dRnd() - 0.5) * 6);
      } else vh = 0;
    }
    if (ground && vh === 0) {
      // On the table: slide to a stop, roll with the slide, tip flat onto the face that is up.
      const v = Math.hypot(vx, vy), dv = DICE_CFG.slide * k * dt;
      if (v > dv) { vx -= vx / v * dv; vy -= vy / v * dv; } else { vx = 0; vy = 0; }
      const roll = [-vy / r, vx / r, w[2]];
      w = w.map((c, i) => c + (roll[i] - c) * Math.min(1, 10 * dt));
      const up = _qRot(q, DICE_SLOTS[_dUpSlot(q)]);
      const err = _cross(up, [0, 0, 1]);             // axis * sin(angle) that would bring it flat
      const slow = Math.max(0, 1 - v / (140 * k));
      w = w.map((c, i) => c * (1 - 6 * slow * dt) + err[i] * 260 * slow * dt);
      w[2] *= (1 - 3 * dt);
      if (v < 4 && Math.hypot(...w) < 0.6 && Math.hypot(err[0], err[1]) < 0.01) still += dt; else still = 0;
    }
    // Walls.
    if (x < minX) { x = minX; vx = Math.abs(vx) * DICE_CFG.wall; w[1] = -w[1] * 0.7; w[2] += (_dRnd() - 0.5) * 8; }
    if (x > maxX) { x = maxX; vx = -Math.abs(vx) * DICE_CFG.wall; w[1] = -w[1] * 0.7; w[2] += (_dRnd() - 0.5) * 8; }
    if (y < minY) { y = minY; vy = Math.abs(vy) * DICE_CFG.wall; w[0] = -w[0] * 0.7; w[2] += (_dRnd() - 0.5) * 8; }
    if (y > maxY) { y = maxY; vy = -Math.abs(vy) * DICE_CFG.wall; w[0] = -w[0] * 0.7; w[2] += (_dRnd() - 0.5) * 8; }
    x += vx * dt; y += vy * dt;
    const wl = Math.hypot(...w);
    if (wl > 1e-6) q = _qNorm(_qMul(_qAxis(w, wl * dt), q));
    acc += dt;
    if (acc >= 1 / 60 - 1e-9) { acc = 0; frames.push({ x, y, h, q }); }
    t += dt;
    if (still > 0.12 && t > 0.5) break;
  }
  // Exactly flat on the last frame (the settle leaves it a hair off).
  const last = frames[frames.length - 1] || { x, y, h: 0, q };
  const up = _qRot(last.q, DICE_SLOTS[_dUpSlot(last.q)]);
  const flat = _qNorm(_qMul(_qArc(up, [0, 0, 1]), last.q));
  const n = Math.min(8, frames.length);
  for (let i = 0; i < n; i++) {
    const f = frames[frames.length - n + i];
    f.q = _qSlerp(f.q, flat, (i + 1) / n);
    f.h = f.h * (1 - (i + 1) / n);
  }
  return frames;
}

// ── drawing ──
// `red` draws a positive face on the red die too (the D6 Trick's mult roll).
function diceFaceHTML(v, red) {
  const a = Math.abs(v), r = red || v < 0;
  if (Number.isInteger(v) && a >= 1 && a <= 6)
    return `<div class="ds-f ${r ? 'ds-red' : 'ds-white'}" style="background-image:url(assets/dice/${r ? 'red' : 'white'}${a}.png)"><i></i></div>`;
  return `<div class="ds-f ds-txt ${r ? 'ds-red' : 'ds-white'}"><span>${v > 0 && !red ? '+' + v : v}</span><i></i></div>`;
}
const DICE_LIGHT = (() => { const l = [-0.35, -0.55, 1]; const n = Math.hypot(...l); return l.map(v => v / n); })();

function diceMake(tray, faces, opts) {
  const o = opts || {};
  const s = o.size || DICE_CFG.size;
  tray.classList.add('ds-tray');
  const wrap = document.createElement('div');
  wrap.className = 'ds-die';
  wrap.style.setProperty('--ds', s + 'px');
  const slotFace = [];
  DICE_SLOT_OF.forEach((slot, i) => { slotFace[slot] = faces[i % faces.length]; });
  wrap.innerHTML = `<div class="ds-shadow"></div><div class="ds-cube">${slotFace.map(v => diceFaceHTML(v, o.red)).join('')}</div>`;
  tray.appendChild(wrap);
  const shadow = wrap.querySelector('.ds-shadow'), cube = wrap.querySelector('.ds-cube');
  const faceEls = [...cube.querySelectorAll('.ds-f')];
  const shades = faceEls.map(f => f.querySelector('i'));
  // Each face is placed by its own matrix, so the slot normals above are what is drawn.
  faceEls.forEach((f, i) => {
    const n = DICE_SLOTS[i];
    f.style.transform = _qMatrix(_qArc([0, 0, 1], n), n.map(c => c * s / 2));
  });
  let state = null, spin = [1, 0, 0, 0], run = 0;
  const W = () => tray.clientWidth || 120, H = () => tray.clientHeight || 80;
  const draw = f => {
    const q = _qMul(f.q, spin);
    cube.style.transform = `translate3d(${(f.x - s / 2).toFixed(2)}px,${(f.y - s / 2).toFixed(2)}px,${f.h.toFixed(2)}px) ${_qMatrix(q, [0, 0, 0])}`;
    const lift = Math.min(1, f.h / (s * 2.5));
    shadow.style.transform = `translate(${(f.x - s / 2 + f.h * 0.35).toFixed(2)}px,${(f.y - s / 2 + f.h * 0.55).toFixed(2)}px) scale(${(1 + lift * 0.5).toFixed(3)})`;
    shadow.style.opacity = (0.55 * (1 - lift * 0.7)).toFixed(3);
    DICE_SLOTS.forEach((n, i) => {
      const wn = _qRot(q, n);
      const lit = Math.max(0, wn[0] * DICE_LIGHT[0] + wn[1] * DICE_LIGHT[1] + wn[2] * DICE_LIGHT[2]);
      shades[i].style.opacity = (0.62 * (1 - lit)).toFixed(3);
    });
  };
  // Rest a face up at (x, y), turned to a random yaw.
  const restOn = (value, x, y) => {
    const i = Math.max(0, slotFace.indexOf(value));
    const q = _qMul(_qAxis([0, 0, 1], (_dRnd() - 0.5) * 0.8), _qArc(DICE_SLOTS[i], [0, 0, 1]));
    spin = [1, 0, 0, 0];
    state = { x, y, h: 0, q };
    draw(state);
  };
  return {
    el: wrap,
    show(value) { restOn(value, o.x != null ? o.x : W() / 2, o.y != null ? o.y : H() / 2); },
    roll(value, ro) {
      const r = ro || {};
      const my = ++run;
      const slots = slotFace.map((v, i) => v === value ? i : -1).filter(i => i >= 0);
      const want = slots.length ? slots[Math.floor(_dRnd() * slots.length)] : 0;
      if (!state) restOn(slotFace[0], W() / 2, H() / 2);
      if (_dFast()) { restOn(value, state.x, state.y); return Promise.resolve(value); }
      const from = { x: r.x != null ? r.x : state.x, y: r.y != null ? r.y : state.y, h: r.h || 0,
                     q: _qRandom(), dir: r.dir, speed: r.speed, lift: r.lift };
      const frames = diceSimulate(W(), H(), s, from);
      // Turn the die at the start by the cube rotation that brings the decided face to the
      // slot the throw rests on: spin * n_want must equal n_upSlot.
      const upSlot = _dUpSlot(frames[frames.length - 1].q);
      spin = _qArc(DICE_SLOTS[want], DICE_SLOTS[upSlot]);
      if (o.sfx !== false && r.sfx !== false) {
        try { if (typeof sfxDiceThrow === 'function') sfxDiceThrow(); } catch (e) {}
      }
      wrap.classList.add('ds-moving');
      const t0 = performance.now(), ms = frames.length * (1000 / 60) / (r.pace || 1);
      return new Promise(res => {
        const step = now => {
          if (my !== run) { res(value); return; }
          const i = Math.max(0, Math.min(frames.length - 1, Math.floor((now - t0) / ms * frames.length)));   // a frame stamp can be earlier than t0 (r511)
          draw(frames[i]);
          if (i < frames.length - 1 && !_dFast()) { requestAnimationFrame(step); return; }
          state = { ...frames[frames.length - 1], q: _qMul(frames[frames.length - 1].q, spin) };
          spin = [1, 0, 0, 0];
          draw(state);
          wrap.classList.remove('ds-moving');
          wrap.classList.remove('ds-land'); void wrap.offsetWidth; wrap.classList.add('ds-land');
          res(value);
        };
        requestAnimationFrame(step);
      });
    },
  };
}

// ── a throw over the board ──
// A body-level table laid over a viewport rect (popups placed in viewport px live
// outside #cabinet, CLAUDE.md), the die drawn at the stage's zoom. The die is thrown
// in from `opts.from` ('below' default), lands, holds, and the table fades.
function diceThrowAt(rect, faces, value, opts) {
  const o = opts || {};
  const stage = document.getElementById('stage');
  const z = stage ? (stage.getBoundingClientRect().width / (stage.offsetWidth || 1)) || 1 : 1;
  const W = Math.max(60, rect.width / z), H = Math.max(50, rect.height / z);
  const layer = document.createElement('div');
  layer.className = 'ds-pop';
  // zoom scales left / top as well, so they are given in design px too
  layer.style.cssText = `left:${rect.left / z}px;top:${rect.top / z}px;width:${W}px;height:${H}px;zoom:${z}`;
  document.body.appendChild(layer);
  const s = o.size || 30;
  // opts.x / opts.y: where the die starts, 0..1 of the table; opts.dir: the throw's heading.
  const x0 = W * (o.x != null ? o.x : 0.2), y0 = H * (o.y != null ? o.y : 0.85);
  const die = diceMake(layer, faces, { size: s, x: x0, y: y0, red: o.red });
  die.show(faces[0]);
  const hold = o.hold != null ? o.hold : 900;
  return die.roll(value, { dir: o.dir != null ? o.dir : -Math.PI / 2 + (_dRnd() - 0.5) * 1.4, speed: o.speed || Math.max(W, H) * 1.6, lift: 380 })
    .then(() => {
      if (o.label) {
        const l = document.createElement('div');
        l.className = 'ds-pop-label' + (o.labelCls ? ' ' + o.labelCls : '');
        l.textContent = o.label;
        layer.appendChild(l);
      }
      return new Promise(r => setTimeout(r, _dFast() ? 300 : hold));
    })
    .then(() => {
      layer.classList.add('ds-pop-out');
      setTimeout(() => layer.remove(), 300);
      return value;
    });
}

// ── the D6 Trick (sixes_perm) ──
// play-hand.js rolls the number; this throws a die out of the Trick's tray chip
// that lands on it: white for pips, red for mult. Two in one hand go one after
// the other. Cosmetic only: the buff is already on the card.
let _d6Waiting = 0;
function diceD6Fx(roll, kind) {
  try {
    if (typeof document === 'undefined' || !document.body) return;
    const t = (typeof trickTray !== 'undefined' ? trickTray : []).find(x => x && (x.id === 'sixes_perm' || (x.acts || []).includes('sixes_perm')));
    const chip = t && typeof danceEntityEl === 'function' ? danceEntityEl('trick', t.id) : null;
    if (!chip) return;
    const lo = BAL.sixes_perm.roll_min, faces = [0, 1, 2, 3, 4, 5].map(i => lo + i);
    if (!faces.includes(roll)) faces[0] = roll;
    const delay = _d6Waiting++ * 420;
    setTimeout(() => {
      // The die rolls across the Tricks tray's own screen, out of the D6 chip: console
      // mode's housing hides anything that is not over a screen (js/machine-skin.js).
      if (!chip.isConnected) return;
      const tray = chip.closest('#trick-tray-area') || chip.parentElement;
      const t = tray.getBoundingClientRect(), c = chip.getBoundingClientRect();
      const rect = { left: t.left + 3, top: t.top + 3, width: t.width - 6, height: t.height - 6 };
      const fx = Math.max(0.08, Math.min(0.92, (c.left + c.width / 2 - rect.left) / rect.width));
      const fy = Math.max(0.15, Math.min(0.85, (c.top + c.height / 2 - rect.top) / rect.height));
      const dir = (fx < 0.5 ? 0 : Math.PI) + (_dRnd() - 0.5) * 0.8;   // toward the emptier side
      diceThrowAt(rect, faces, roll, { x: fx, y: fy, dir, red: kind === 'mult', size: 30,
        label: `+${roll} ${kind === 'mult' ? 'MULT' : 'PIPS'}`, labelCls: kind })
        .finally(() => { _d6Waiting = Math.max(0, _d6Waiting - 1); });
    }, delay);
  } catch (e) {}
}

// The sound the coded set falls back on when the throw file is off: a few dry
// knocks, quieter and closer together as the die settles.
function sfxDiceThrow() {
  try {
    const ctx = getAudioCtx(), out = sfxOut(ctx), t0 = ctx.currentTime;
    for (let i = 0; i < 6; i++) {
      const t = t0 + 0.05 + i * (0.11 - i * 0.012), g = ctx.createGain(), o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.setValueAtTime(900 + fxRandom() * 500, t);
      o.frequency.exponentialRampToValueAtTime(240, t + 0.03);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.12 * (1 - i * 0.13) * sfxVolume(), t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
      o.connect(g); g.connect(out);
      o.start(t); o.stop(t + 0.06);
    }
  } catch (e) {}
}
