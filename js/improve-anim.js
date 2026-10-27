// ══ THE IMPROVEMENT ANIMATION (r627, owner) ══════════════════════════════════
// When a Trick (or Knack / Sleight) is improved, its tile comes to the middle of
// the board, the band across its corner animates in while the description's
// numbers change, and it goes back to the tray. Three looks (IA_LOOKS):
//   lift   the tile rises out of the tray to the centre; the new band wipes in
//          from the corner; the changed numbers roll like a counter
//   stamp  the tile pops up at the centre; the new band is stamped down on it
//          (a slam, a shake, a ring); the old number is struck, the new stamped
//   flip   the tile slides to the centre and turns over; the new tier is on the
//          back; the old sentence slides out, the new one in
// improveEntity QUEUES an entry (one per entity, a step per tier) and the queue
// is played by improveAnimFlush(): on its own a moment later, or when a caller
// that runs a sequence (the reward grid's confirm, Flow's improve step) holds it
// (improveAnimHold) and awaits the flush at the END, so a many-tiered grant
// plays last. A FAST FORWARD key (#ia-skip, top centre) ends the whole sequence.
// Printer notices that print while it runs hang longer (PT_CFG.overChangeHold).
// Dev -> Aesthetics -> Improvement animation: look, speed, size, hold, Preview.
// Store lethe.improveAnim.v1, overrides only.

const IA_KEY = 'lethe.improveAnim.v1';
const IA_LOOKS = ['lift', 'stamp', 'flip'];
const IA_DEFAULT = { look: 'stamp', speed: 1, size: 46, hold: 1100, stepGap: 420 };   // r632 (owner): stamp, on the board's screen
let iaCfg = (() => {
  const c = { ...IA_DEFAULT };
  try { Object.assign(c, JSON.parse(localStorage.getItem(IA_KEY) || '{}')); } catch (e) {}
  if (!IA_LOOKS.includes(c.look)) c.look = IA_DEFAULT.look;
  return c;
})();
function iaSet(k, v) {
  if (k === 'look' && !IA_LOOKS.includes(v)) return;
  if (k !== 'look') { v = +v; if (!isFinite(v)) return; }
  iaCfg[k] = v;
  try {
    const o = {}; for (const key in iaCfg) if (iaCfg[key] !== IA_DEFAULT[key]) o[key] = iaCfg[key];
    Object.keys(o).length ? localStorage.setItem(IA_KEY, JSON.stringify(o)) : localStorage.removeItem(IA_KEY);
  } catch (e) {}
  iaDevSync();
}
function iaDevSync() {
  const q = id => document.getElementById(id);
  if (q('dev-ia-look')) q('dev-ia-look').value = iaCfg.look;
  [['speed', 'dev-ia-speed'], ['size', 'dev-ia-size'], ['hold', 'dev-ia-hold']].forEach(([k, id]) => {
    if (q(id)) q(id).value = iaCfg[k];
    if (q(id + '-v')) q(id + '-v').textContent = k === 'speed' ? iaCfg[k].toFixed(2) + 'x' : k === 'size' ? iaCfg[k] + '%' : iaCfg[k] + 'ms';
  });
}
// Every duration goes through this: speed 2 = twice as fast.
function iaMs(ms) { return Math.max(1, ms / (iaCfg.speed || 1)); }

// ── The queue ───────────────────────────────────────────────────────────────
let _iaQueue = [], _iaHold = 0, _iaTimer = 0, _iaRunning = false, _iaSkip = false, _iaCurrent = null;
function improveAnimRunning() { return !!_iaRunning; }
// improveEntity calls this BEFORE and AFTER applying a tier: `before` captures
// the printed text, `after` closes the step. Consecutive steps of one entity
// merge into one entry with a step per tier. r668: a tier going DOWN (a failed
// challenge, downgradeEntity with opts.anim) plays the same scene in reverse.
function improveAnimNote(id, fromTier, toTier, descBefore, descAfter) {
  if (!id || toTier === fromTier) return;
  const down = toTier < fromTier, d = down ? -1 : 1;
  let e = _iaQueue.find(x => x.id === id && !!x.down === down);
  if (!e) { e = { id, from: fromTier, to: toTier, before: descBefore, steps: [], down }; _iaQueue.push(e); }
  for (let t = fromTier + d; down ? t >= toTier : t <= toTier; t += d) e.steps.push({ tier: t, desc: descAfter });
  e.to = toTier;
  if (!_iaHold && !_iaRunning) { clearTimeout(_iaTimer); _iaTimer = setTimeout(() => improveAnimFlush(), 0); }
}
function improveAnimHold(on) { _iaHold = Math.max(0, _iaHold + (on ? 1 : -1)); }
// Plays everything queued, one entity after another. Resolves when done (or at
// once when nothing is queued, so callers can always await it).
async function improveAnimFlush() {
  clearTimeout(_iaTimer); _iaTimer = 0;
  if (_iaRunning) { await _iaRunning; }
  if (!_iaQueue.length) return;
  // r646: `_iaRunning` is set BEFORE the runner starts. With every entry skipped
  // (look 'none', reduced motion) the runner used to finish synchronously, its
  // finally clearing the flag before `_iaRunning = run` set it to a promise that
  // had already settled - so the flag read "running" for good and no later note
  // ever scheduled a flush.
  let _done; const run = new Promise(res => { _done = res; });
  _iaRunning = run;
  (async () => {
    _iaSkip = false;
    try {
      while (_iaQueue.length) {
        const e = _iaQueue.shift();
        if (_iaSkip || iaOff()) continue;
        try { await ((e.kind === 'fuse' && typeof iaPlayFuse === 'function') ? iaPlayFuse(e) : iaPlay(e)); } catch (err) { console.error('[IMPROVE-ANIM]', err); }   // r646: a fusion (js/inseparable.js) rides the same queue
      }
    } finally { _iaRunning = false; _iaSkip = false; iaTeardown(); _done(); }
  })();
  await run;
}
function iaOff() {
  return (typeof skipOn === 'function' && skipOn('transitions')) || document.body.classList.contains('reduced-motion') || iaCfg.look === 'none';
}
// FAST FORWARD: the running look ends at once and the rest of the queue is dropped.
function improveAnimSkip() {
  if (!_iaRunning) return;
  _iaSkip = true;
  _iaQueue.length = 0;
  if (_iaCurrent && _iaCurrent.skip) _iaCurrent.skip();
}

// ── Where things are ────────────────────────────────────────────────────────
function iaStage() {
  const st = document.getElementById('stage'); if (!st) return null;
  const sr = st.getBoundingClientRect(), z = sr.width / (st.offsetWidth || 1);
  return z > 0.01 ? { st, sr, z } : null;
}
// A rect in the stage's design px.
function iaRectOf(el, S) {
  const r = el.getBoundingClientRect();
  return { l: (r.left - S.sr.left) / S.z, t: (r.top - S.sr.top) / S.z, w: r.width / S.z, h: r.height / S.z };
}
function iaEntity(id) {
  const find = p => (p || []).find(e => e && e.id === id);
  let e = find(typeof trickTray !== 'undefined' ? trickTray : null); if (e) return { e, type: 'trick' };
  e = find(typeof acquiredKnacks !== 'undefined' ? acquiredKnacks : null); if (e) return { e, type: 'knack' };
  e = find(typeof TRICK_POOL_ALL !== 'undefined' ? TRICK_POOL_ALL : null); if (e) return { e, type: 'trick' };
  e = find(typeof KNACK_POOL !== 'undefined' ? KNACK_POOL : null); if (e) return { e, type: 'knack' };
  e = find(typeof SLEIGHT_POOL !== 'undefined' ? SLEIGHT_POOL : null); if (e) return { e, type: 'sleight' };
  return null;
}
function iaChipFor(id, type) {
  if (type === 'trick') return document.querySelector(`#trick-tray-list .trick-tray-chip[data-trick-id="${id}"]`);
  if (type === 'knack') return document.querySelector(`.knack-chip[data-knack-id="${id}"]`);
  return null;
}
// The tile at a given tier: the shared entity tile, drawn with entityTier set
// to that tier for the call (the class and the badge read entityTierOf).
function iaTileHTML(ent, type, tier) {
  const was = (typeof entityTier !== 'undefined') ? entityTier[ent.id] : undefined;
  try {
    entityTier[ent.id] = tier;
    const rar = ent.tier || ent.rarity || 'common';
    const p = { entity: type, id: ent.id, label: ent.name, emoji: type === 'trick' && typeof trickEmoji === 'function' ? trickEmoji(ent) : (ent.emoji || '★') };
    return entityTileHTML(p, rar, { tip: false });
  } finally { if (was === undefined) delete entityTier[ent.id]; else entityTier[ent.id] = was; }
}

// ── The description with its moving numbers ─────────────────────────────────
// Same rule as improveDeltaHTML (js/improve.js): the two sentences must be the
// same sentence apart from their numbers, or the whole text crossfades.
function iaDescParts(before, after) {
  const a = String(before || ''), b = String(after || '');
  if (!a || !b || typeof _IMP_NUM_SPLIT === 'undefined') return null;
  const pa = a.split(_IMP_NUM_SPLIT), pb = b.split(_IMP_NUM_SPLIT);
  if (pa.length !== pb.length) return null;
  for (let i = 0; i < pa.length; i += 2) if (pa[i] !== pb[i]) return null;
  const out = []; let moved = 0;
  for (let i = 0; i < pa.length; i++) {
    if (i % 2 === 0) out.push({ lit: pa[i] });
    else { out.push({ num: pa[i], to: pb[i], changed: pa[i] !== pb[i] }); if (pa[i] !== pb[i]) moved++; }
  }
  return moved ? out : null;
}
function iaEsc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function iaDescHTML(before, after) {
  const parts = iaDescParts(before, after);
  if (!parts) return { html: `<span class="ia-whole">${iaEsc(before)}</span>`, whole: true };
  return { html: parts.map(p => p.lit != null ? iaEsc(p.lit)
    : p.changed ? `<b class="ia-num" data-from="${iaEsc(p.num)}" data-to="${iaEsc(p.to)}"><span class="ia-n-old">${iaEsc(p.num)}</span><span class="ia-n-new">${iaEsc(p.to)}</span></b>`
    : iaEsc(p.num)).join(''), whole: false };
}

// ── The play ────────────────────────────────────────────────────────────────
// The scene is a SCREEN laid over the board's box (r632, owner): an amber glass
// like the event screens, opaque, so it replaces whatever the board holds. The
// header and the sentence TYPE out at the game's text speed with one block
// cursor; the tile pops / rises / flips in above the text and its new tier is
// stamped on; the version and the changed numbers move in place. Every step of
// a many-tiered grant, and every later improvement of the same Trick, runs
// IA_STEP_SPEED (10%) faster than the one before (k = 1.1 ^ (tier - 1)).
const IA_STEP_SPEED = 1.1;
let _iaLayer = null;
function iaLayer(S) {
  if (!_iaLayer || !_iaLayer.isConnected) {
    _iaLayer = document.createElement('div'); _iaLayer.id = 'ia-layer';
    _iaLayer.innerHTML = '<button id="ia-skip" type="button"><span class="ia-ff">⏩</span> FAST FORWARD</button>';
    _iaLayer.querySelector('#ia-skip').addEventListener('click', e => { e.stopPropagation(); improveAnimSkip(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && _iaRunning) improveAnimSkip(); });
    document.body.appendChild(_iaLayer);
  }
  // Zoomed like the stage, so every length inside is design px: the box itself
  // is given in design px too (its viewport px divided by the zoom, r503's rule).
  const s = _iaLayer.style;
  s.zoom = S.z;
  s.left = (S.sr.left / S.z) + 'px'; s.top = (S.sr.top / S.z) + 'px'; s.width = S.st.offsetWidth + 'px'; s.height = S.st.offsetHeight + 'px';
  _iaLayer.classList.add('ia-on');
  return _iaLayer;
}
function iaTeardown() {
  if (_iaLayer) { _iaLayer.classList.remove('ia-on', 'ia-many'); _iaLayer.querySelectorAll('.ia-scene').forEach(n => n.remove()); }
}
const iaWait = (ms, ctl) => new Promise(res => { if (ctl.skipped) return res(); const t = setTimeout(res, ms); ctl.timers.push(t); ctl.resolvers.push(res); });
function iaAnim(el, frames, opts, ctl) {
  if (ctl.skipped) { return Promise.resolve(); }
  const a = el.animate(frames, opts); ctl.anims.push(a);
  return a.finished.catch(() => {});
}
let _iaDown = false;   // r668: the scene playing is a downgrade, so its stamps sound like a loss
function iaSfx(name, k) { if (_iaDown && name === 'sfxSuccess') name = 'sfxChallengePenalty'; try { if (typeof window[name] === 'function') window[name](k); } catch (e) {} }
// A step's length: the look's speed, then the step's own speed-up.
function iaMsK(ms, k) { return iaMs(ms) / (k || 1); }

// ── Typing, the event screens' way ──────────────────────────────────────────
// Every character of a line is its own span, hidden until typed (the room is
// held, so nothing reflows); a changed number is one unit. One cursor, moved
// after each unit; it blinks while idle.
function iaTypeWrap(el) {
  const walk = n => {
    [...n.childNodes].forEach(c => {
      if (c.nodeType === 3) {
        const frag = document.createDocumentFragment();
        for (const ch of c.textContent) { const i = document.createElement('i'); i.className = 'ia-ch ia-tu'; i.textContent = ch; frag.appendChild(i); }
        c.replaceWith(frag);
      } else if (c.classList && c.classList.contains('ia-num')) c.classList.add('ia-tu');
      else walk(c);
    });
  };
  walk(el);
}
function iaCursor(scene) {
  let c = scene.querySelector('.ia-cur');
  if (!c) { c = document.createElement('i'); c.className = 'ia-cur'; }
  return c;
}
async function iaType(scene, el, ctl, k) {
  const cur = iaCursor(scene);
  const units = [...el.querySelectorAll('.ia-tu')];
  const cps = (typeof textTypeCps === 'function') ? textTypeCps() : 160;
  const per = cps > 0 ? 1000 / cps / (k || 1) : 0;
  cur.classList.add('typing');
  for (const u of units) {
    if (ctl.skipped || per === 0) { units.forEach(x => x.classList.remove('ia-tu')); break; }
    u.classList.remove('ia-tu'); u.after(cur);
    if (u.textContent !== ' ') await iaWait(per, ctl);
  }
  const last = units[units.length - 1]; if (last) last.after(cur);
  cur.classList.remove('typing');
}

async function iaPlay(entry) {
  const S = iaStage(); if (!S) return;
  const found = iaEntity(entry.id); if (!found) return;
  const { e: ent, type } = found;
  const layer = iaLayer(S);
  const ctl = { skipped: false, timers: [], anims: [], resolvers: [], steps: entry.steps.length,
    skip() { this.skipped = true; this.timers.forEach(clearTimeout); this.anims.forEach(a => { try { a.finish(); } catch (err) { try { a.cancel(); } catch (e2) {} } }); this.resolvers.forEach(r => r()); } };
  _iaCurrent = ctl; _iaDown = !!entry.down;
  layer.classList.toggle('ia-many', _iaQueue.length > 0 || ctl.steps > 1);

  // The board's box is the screen; the tray chip (if drawn) is where the tile
  // comes from and goes back to, else it pops from the screen's middle.
  const grid = document.getElementById('grid-slot') || document.getElementById('grid');
  const g = grid ? iaRectOf(grid, S) : { l: 0, t: 0, w: S.st.offsetWidth, h: S.st.offsetHeight };
  const chip = iaChipFor(ent.id, type);
  const src = chip ? iaRectOf(chip.querySelector('.reward-cell') || chip, S) : null;
  const size = Math.max(60, Math.min(g.w, g.h) * (iaCfg.size / 100));
  const rar = ent.tier || ent.rarity || 'common';
  const scene = document.createElement('div'); scene.className = `ia-scene ia-${iaCfg.look} ia-${type}${entry.down ? ' ia-down' : ''}`;
  scene.style.setProperty('--ia-size', size + 'px');
  const screen = document.createElement('div'); screen.className = 'ia-screen';
  screen.style.left = g.l + 'px'; screen.style.top = g.t + 'px'; screen.style.width = g.w + 'px'; screen.style.height = g.h + 'px';
  screen.innerHTML = `<div class="ia-head">&gt; ${entry.down ? 'DOWNGRADING' : 'IMPROVING'} <b class="ia-name rar-${rar}">${iaEsc(ent.name).toUpperCase()}</b></div>`
    + `<div class="ia-term"><div class="ia-ver"></div><div class="ia-desc"></div></div>`;
  // The tile: one copy per tier, the real entity tile at that tier, the current one shown.
  const tile = document.createElement('div'); tile.className = 'ia-tile';
  const layers = [];
  const dir = entry.to >= entry.from ? 1 : -1;
  for (let t = entry.from; dir > 0 ? t <= entry.to : t >= entry.to; t += dir) {
    const l = document.createElement('div'); l.className = 'ia-tier' + (t === entry.from ? ' ia-shown' : '');
    l.dataset.tier = t; l.innerHTML = iaTileHTML(ent, type, t); tile.appendChild(l); layers.push(l);
  }
  const fx = document.createElement('div'); fx.className = 'ia-fx'; tile.appendChild(fx);
  screen.appendChild(tile); scene.appendChild(screen); layer.appendChild(scene);
  const head = screen.querySelector('.ia-head'), term = screen.querySelector('.ia-term');
  const verEl = term.querySelector('.ia-ver'), descEl = term.querySelector('.ia-desc');
  const headH = 24, pad = 10;
  tile.style.width = size + 'px'; tile.style.height = size + 'px';
  tile.style.left = ((g.w - size) / 2) + 'px'; tile.style.top = (pad + headH + 6) + 'px';
  term.style.top = (pad + headH + 6 + size + 10) + 'px';
  const cx = g.l + g.w / 2, cy = g.t + pad + headH + 6 + size / 2;
  const from = src ? { x: src.l + src.w / 2 - cx, y: src.t + src.h / 2 - cy, s: Math.max(0.12, src.w / size) } : { x: 0, y: 0, s: 0.2 };
  const setVer = (a, b) => { verEl.innerHTML = `<b class="ia-num ia-ver-num"><span class="ia-n-old">v${a + 1}.0</span><span class="ia-n-new">v${b + 1}.0</span></b>`; };
  const setDesc = (before, after) => { const d = iaDescHTML(before, after); descEl.innerHTML = d.html; descEl.classList.toggle('ia-desc-whole', d.whole); };
  if (chip) chip.classList.add('ia-away');

  const look = IA_RUN[iaCfg.look] || IA_RUN.stamp;
  const k0 = Math.pow(IA_STEP_SPEED, Math.max(0, entry.from));   // the Nth improvement of this Trick is faster
  try {
    // the screen comes on (a CRT: a line that opens), the header types, the tile arrives
    iaSfx('sfxPrintFeed');
    await iaAnim(screen, [{ clipPath: 'inset(50% 0 50% 0)', opacity: .6 }, { clipPath: 'inset(0 0 0 0)', opacity: 1 }], { duration: iaMsK(180, k0), easing: 'ease-out', fill: 'forwards' }, ctl);
    iaTypeWrap(head);
    const typing = iaType(scene, head, ctl, k0);
    await Promise.all([typing, look.arrive(tile, from, ctl, k0)]);
    let prevDesc = entry.before;
    setVer(entry.from, entry.steps[0].tier); setDesc(prevDesc, entry.steps[0].desc);
    iaTypeWrap(verEl); iaTypeWrap(descEl);
    await iaType(scene, verEl, ctl, k0); await iaType(scene, descEl, ctl, k0);
    for (let i = 0; i < entry.steps.length; i++) {
      const step = entry.steps[i], k = Math.pow(IA_STEP_SPEED, Math.max(0, step.tier - 1));
      if (i) { setVer(entry.steps[i - 1].tier, step.tier); setDesc(prevDesc, step.desc); await iaWait(iaMsK(iaCfg.stepGap, k), ctl); }
      await look.band(tile, layers[i], layers[i + 1], term, ctl, k);
      prevDesc = step.desc;
    }
    const kEnd = Math.pow(IA_STEP_SPEED, Math.max(0, entry.to - 1));
    await iaWait(iaMsK(iaCfg.hold, kEnd), ctl);
    await look.leave(tile, from, ctl, kEnd);
    iaSfx('sfxPrintFeed');
    await iaAnim(screen, [{ clipPath: 'inset(0 0 0 0)', opacity: 1 }, { clipPath: 'inset(50% 0 50% 0)', opacity: .5 }], { duration: iaMsK(150, kEnd), easing: 'ease-in', fill: 'forwards' }, ctl);
  } finally {
    scene.remove();
    if (chip) { chip.classList.remove('ia-away'); const tray = chip.closest('#trick-tray-area, #knack-tray-area, #knack-list-area, .tray'); if (tray && typeof trayFxKick === 'function') trayFxKick(tray, 'in'); }
    _iaCurrent = null; _iaDown = false;
  }
}

// The version and the changed numbers move: each marked number plays its own
// small move, staggered.
function iaRollNumbers(term, kind, ctl, k) {
  const nums = [...term.querySelectorAll('.ia-num:not(.ia-rolled)')];
  const ps = nums.map((n, i) => (async () => {
    await iaWait(iaMsK(90 * i, k), ctl);
    n.classList.add('ia-rolled', 'ia-' + kind);
    const o = n.querySelector('.ia-n-old'), w = n.querySelector('.ia-n-new');
    if (kind === 'roll') {
      await Promise.all([
        iaAnim(o, [{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-110%)', opacity: 0 }], { duration: iaMsK(260, k), easing: 'cubic-bezier(.4,0,.6,1)', fill: 'forwards' }, ctl),
        iaAnim(w, [{ transform: 'translateY(110%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: iaMsK(300, k), easing: 'cubic-bezier(.2,.9,.3,1.2)', fill: 'forwards' }, ctl)]);
    } else if (kind === 'stamp') {
      await iaAnim(o, [{ opacity: 1 }, { opacity: .55 }], { duration: iaMsK(120, k), fill: 'forwards' }, ctl);
      await iaAnim(w, [{ transform: 'scale(2.2) rotate(-8deg)', opacity: 0 }, { transform: 'scale(1) rotate(-4deg)', opacity: 1, offset: .55 }, { transform: 'scale(1.08) rotate(-4deg)', offset: .75 }, { transform: 'scale(1) rotate(-4deg)', opacity: 1 }], { duration: iaMsK(320, k), easing: 'cubic-bezier(.3,0,.2,1)', fill: 'forwards' }, ctl);
    } else {
      await Promise.all([
        iaAnim(o, [{ transform: 'translateX(0)', opacity: 1 }, { transform: 'translateX(-60%)', opacity: 0 }], { duration: iaMsK(240, k), easing: 'ease-in', fill: 'forwards' }, ctl),
        iaAnim(w, [{ transform: 'translateX(60%)', opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }], { duration: iaMsK(300, k), easing: 'cubic-bezier(.2,.9,.3,1.1)', fill: 'forwards' }, ctl)]);
    }
  })());
  const whole = term.querySelector('.ia-desc-whole');
  if (whole) ps.push(iaAnim(whole, [{ opacity: .35 }, { opacity: 1 }], { duration: iaMsK(400, k), fill: 'forwards' }, ctl));
  return Promise.all(ps);
}
function iaFlash(tile, ctl, ms, k) {
  const f = document.createElement('div'); f.className = 'ia-flash'; tile.querySelector('.ia-fx').appendChild(f);
  return iaAnim(f, [{ opacity: 0 }, { opacity: .9, offset: .2 }, { opacity: 0 }], { duration: iaMsK(ms || 360, k), fill: 'forwards' }, ctl).then(() => f.remove());
}

// The tile's part of each look. arrive / leave take the tile between the tray
// chip and its place on the screen; band puts the next tier on.
const IA_RUN = {
  // LIFT: rises out of the tray on an arc, grows; the new band wipes in from the
  // bottom-left corner behind a bright edge; the numbers roll like a counter.
  lift: {
    async arrive(tile, from, ctl, k) {
      await iaAnim(tile, [
        { transform: `translate(${from.x}px, ${from.y}px) scale(${from.s})`, opacity: from.s < 0.2 ? 0 : 1 },
        { transform: `translate(${from.x * 0.35}px, ${from.y * 0.35 - 30}px) scale(${(from.s + 1) / 2 + 0.1})`, opacity: 1, offset: .55 },
        { transform: 'translate(0, 0) scale(1)', opacity: 1 }], { duration: iaMsK(560, k), easing: 'cubic-bezier(.2,.8,.25,1)', fill: 'forwards' }, ctl);
    },
    async band(tile, oldL, newL, term, ctl, k) {
      newL.classList.add('ia-shown');
      const sweep = document.createElement('div'); sweep.className = 'ia-sweep'; tile.querySelector('.ia-fx').appendChild(sweep);
      iaSfx('sfxSuccess');
      const wipe = iaAnim(newL, [
        { clipPath: 'polygon(-10% 110%, -10% 110%, -10% 110%)' },
        { clipPath: 'polygon(-10% 110%, -10% -130%, 230% 110%)' }], { duration: iaMsK(620, k), easing: 'cubic-bezier(.3,.1,.3,1)', fill: 'forwards' }, ctl);
      const sw = iaAnim(sweep, [{ transform: 'translate(-70%, 70%) rotate(45deg)', opacity: 0 }, { opacity: 1, offset: .15 }, { opacity: 1, offset: .8 }, { transform: 'translate(70%, -70%) rotate(45deg)', opacity: 0 }], { duration: iaMsK(620, k), easing: 'cubic-bezier(.3,.1,.3,1)', fill: 'forwards' }, ctl).then(() => sweep.remove());
      const nums = iaWait(iaMsK(200, k), ctl).then(() => iaRollNumbers(term, 'roll', ctl, k));
      await Promise.all([wipe, sw, nums]);
      oldL.classList.remove('ia-shown');
      await iaFlash(tile, ctl, 300, k);
    },
    async leave(tile, from, ctl, k) {
      await iaAnim(tile, [
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(${from.x}px, ${from.y}px) scale(${from.s})`, opacity: from.s < 0.2 ? 0 : 1 }], { duration: iaMsK(420, k), easing: 'cubic-bezier(.5,0,.8,.4)', fill: 'forwards' }, ctl);
    },
  },
  // STAMP: pops up; the new tier is slammed down onto it from above (a shake, a
  // ring); the old number is struck and the new one stamped beside it.
  stamp: {
    async arrive(tile, from, ctl, k) {
      await iaAnim(tile, [
        { transform: 'translate(0, 0) scale(.2)', opacity: 0 },
        { transform: 'translate(0, 0) scale(1.14)', opacity: 1, offset: .7 },
        { transform: 'translate(0, 0) scale(1)', opacity: 1 }], { duration: iaMsK(420, k), easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' }, ctl);
    },
    async band(tile, oldL, newL, term, ctl, k) {
      newL.classList.add('ia-shown');
      await iaAnim(newL, [{ transform: 'scale(1.9)', opacity: 0, filter: 'brightness(2)' }, { transform: 'scale(1)', opacity: 1, filter: 'brightness(1.6)' }], { duration: iaMsK(240, k), easing: 'cubic-bezier(.6,0,1,.6)', fill: 'forwards' }, ctl);
      oldL.classList.remove('ia-shown');
      iaSfx('sfxPrintTear'); iaSfx('sfxSuccess');
      const ring = document.createElement('div'); ring.className = 'ia-ring'; tile.appendChild(ring);
      const r = iaAnim(ring, [{ transform: 'scale(.6)', opacity: .9 }, { transform: 'scale(1.9)', opacity: 0 }], { duration: iaMsK(520, k), easing: 'ease-out', fill: 'forwards' }, ctl).then(() => ring.remove());
      const shake = iaAnim(tile, [{ transform: 'translate(0,0) rotate(0)' }, { transform: 'translate(-5px, 3px) rotate(-2.5deg)', offset: .2 }, { transform: 'translate(5px, -2px) rotate(2deg)', offset: .45 }, { transform: 'translate(-3px, 1px) rotate(-1deg)', offset: .7 }, { transform: 'translate(0,0) rotate(0)' }], { duration: iaMsK(340, k), easing: 'ease-out', fill: 'forwards' }, ctl);
      await Promise.all([r, shake, iaRollNumbers(term, 'stamp', ctl, k), iaFlash(tile, ctl, 240, k)]);
    },
    async leave(tile, from, ctl, k) {
      await iaAnim(tile, [
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(${from.x}px, ${from.y}px) scale(${from.s})`, opacity: from.s < 0.2 ? 0 : 1 }], { duration: iaMsK(380, k), easing: 'cubic-bezier(.5,0,.7,.3)', fill: 'forwards' }, ctl);
    },
  },
  // FLIP: slides in, turns over on its vertical axis; the new tier is on the
  // back; the old number slides out left, the new one in from the right.
  flip: {
    async arrive(tile, from, ctl, k) {
      tile.classList.add('ia-3d');
      await iaAnim(tile, [
        { transform: `translate(${from.x}px, ${from.y}px) scale(${from.s}) rotateY(-25deg)`, opacity: from.s < 0.2 ? 0 : 1 },
        { transform: 'translate(0, 0) scale(1) rotateY(0)', opacity: 1 }], { duration: iaMsK(480, k), easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' }, ctl);
    },
    async band(tile, oldL, newL, term, ctl, k) {
      iaSfx('sfxPrintFeed');
      await iaAnim(tile, [{ transform: 'rotateY(0)' }, { transform: 'rotateY(90deg)' }], { duration: iaMsK(260, k), easing: 'cubic-bezier(.5,0,1,.6)', fill: 'forwards' }, ctl);
      oldL.classList.remove('ia-shown'); newL.classList.add('ia-shown');
      iaSfx('sfxSuccess');
      const back = iaAnim(tile, [{ transform: 'rotateY(-90deg)' }, { transform: 'rotateY(12deg)', offset: .7 }, { transform: 'rotateY(0)' }], { duration: iaMsK(380, k), easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' }, ctl);
      await Promise.all([back, iaRollNumbers(term, 'slide', ctl, k), iaFlash(tile, ctl, 300, k)]);
    },
    async leave(tile, from, ctl, k) {
      await iaAnim(tile, [
        { transform: 'translate(0, 0) scale(1) rotateY(0)', opacity: 1 },
        { transform: `translate(${from.x}px, ${from.y}px) scale(${from.s}) rotateY(25deg)`, opacity: from.s < 0.2 ? 0 : 1 }], { duration: iaMsK(400, k), easing: 'cubic-bezier(.5,0,.8,.4)', fill: 'forwards' }, ctl);
    },
  },
};

// ── Preview (dev -> Aesthetics) ─────────────────────────────────────────────
// Plays the look on the first improvable Trick in the tray (or the first of the
// pool) WITHOUT improving it: the descriptions are read from the tier ladder
// and the tier is put back. `tiers` > 1 previews a many-tiered sequence (and the
// FAST FORWARD key).
async function improveAnimPreview(tiers) {
  const n = Math.max(1, +tiers || 1);
  let ent = (typeof trickTray !== 'undefined' && trickTray.find(t => t && typeof canImprove === 'function' && canImprove(t.id)))
    || (typeof TRICK_POOL !== 'undefined' && TRICK_POOL.find(t => typeof canImprove === 'function' && canImprove(t.id)));
  if (!ent) return;
  const id = ent.id, was = entityTierOf(id);
  const descAt = t => { entityTier[id] = t; applyEntityTiers(); const o = (typeof ownedTrickObj === 'function' && ownedTrickObj(id)) || TRICK_POOL_ALL.find(x => x.id === id); return o ? o.desc : ''; };
  const from = Math.min(was, Math.max(0, IMPROVE_MAX_TIER - n));
  const before = descAt(from);
  const steps = []; for (let t = from + 1; t <= Math.min(IMPROVE_MAX_TIER, from + n); t++) steps.push({ tier: t, desc: descAt(t) });
  entityTier[id] = was; applyEntityTiers();
  if (!steps.length) return;
  _iaQueue.push({ id, from, to: steps[steps.length - 1].tier, before, steps });
  await improveAnimFlush();
}

// ── The preview page: index.html?improve ────────────────────────────────────
// Rides the Trick tour (a Classic run with one Trick in the tray) and puts a
// small panel on the screen: a key per look, one for a 3-tier run, and the
// sliders. ?improve alone becomes ?tricks=epic&improve before the tour reads it
// (this file loads first). Nothing here runs without the flag.
(function () {
  if (!/[?&]improve\b/.test(location.search)) return;
  if (!/[?&]tricks\b/.test(location.search)) { try { history.replaceState(null, '', location.pathname + '?tricks=epic&improve'); } catch (e) {} }
  const build = () => {
    document.body.classList.add('ia-lab-on');   // the tour's panel stays hidden (css), whenever it is built
    const el = document.createElement('div'); el.id = 'ia-lab';
    el.innerHTML = `<div class="ia-lab-t">IMPROVEMENT ANIMATION</div>
      <div class="ia-lab-row">${IA_LOOKS.map(l => `<button data-look="${l}">${l.toUpperCase()}</button>`).join('')}<button data-tiers="3">3 TIERS</button></div>
      <label>Speed <input type="range" min="0.4" max="2.5" step="0.05" data-k="speed"> <span data-v="speed"></span></label>
      <label>Size <input type="range" min="20" max="70" step="1" data-k="size"> <span data-v="size"></span></label>
      <label>Hold <input type="range" min="0" max="3000" step="50" data-k="hold"> <span data-v="hold"></span></label>
      <div class="ia-lab-n">A look's key plays it on the tray's Trick. Picked look: <b data-v="look"></b>. Settings save in this browser.</div>`;
    document.body.appendChild(el);
    const sync = () => { el.querySelectorAll('[data-look]').forEach(b => b.classList.toggle('on', b.dataset.look === iaCfg.look)); el.querySelector('[data-v=look]').textContent = iaCfg.look;
      [['speed', v => v.toFixed(2) + 'x'], ['size', v => v + '%'], ['hold', v => v + 'ms']].forEach(([k, f]) => { el.querySelector(`[data-k=${k}]`).value = iaCfg[k]; el.querySelector(`[data-v=${k}]`).textContent = f(iaCfg[k]); }); };
    el.querySelectorAll('[data-look]').forEach(b => b.onclick = () => { iaSet('look', b.dataset.look); sync(); improveAnimPreview(1); });
    el.querySelector('[data-tiers]').onclick = () => improveAnimPreview(3);
    el.querySelectorAll('input[data-k]').forEach(i => i.oninput = () => { iaSet(i.dataset.k, i.value); sync(); });
    sync();
  };
  window.addEventListener('load', () => setTimeout(build, 2600));
})();
