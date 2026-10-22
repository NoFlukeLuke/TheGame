// ══ INSEPARABLE (r646, owner) ═════════════════════════════════════════════════
// Certain PAIRS of Tricks (js/data/inseparable.js) fuse into one Trick the moment
// both are in the tray: the two leave, the fused Trick takes the first one's slot
// (one slot, not two), keeps the higher of their improvement tiers, and carries
// both effects (its own scoring code, e.g. Lie Up in js/scoring.js). Visually it
// is a RED Trick wearing both parts' icons (css/inseparable.css; the tile reads
// inseparableDef in js/entity-tile.js) with a faint pulse under the pointer.
//
// WHERE IT HAPPENS: inseparableCheck() runs from injectTrickAfterReward, the one
// grant site, after the new Trick is in the tray. A FULL tray does not refuse the
// second half of a pair (trickTrayFullFor, js/tricks-ui.js): the fusion frees a
// slot, so the offer fits. The fusion plays through the improvement animation's
// queue and screen (iaPlayFuse, below): both tiles come in from the sides, meet
// in the middle with a flare, and the fused tile stands up and types its line.

function inseparableDef(id) {
  if (typeof INSEPARABLE_PAIRS === 'undefined' || !id) return null;
  return INSEPARABLE_PAIRS.find(p => p.id === id) || null;
}
function inseparablePartOf(id) {
  if (typeof INSEPARABLE_PAIRS === 'undefined' || !id) return null;
  return INSEPARABLE_PAIRS.find(p => p.parts.includes(id)) || null;
}
// The pool row of a part / a fused Trick (for icons and names).
function inseparableRow(id) {
  return (typeof TRICK_POOL_ALL !== 'undefined' && TRICK_POOL_ALL.find(t => t && t.id === id)) || null;
}
// ── r651: a fused Trick STANDS IN for its parts ─────────────────────────────
// A fused row with `acts: [a, b]` makes hasTrick(a) / hasTrick(b) true, serves
// their lines, and its BAL row (holding both parts' keys) is what their code reads
// through TB(part). Payouts billed to a part land on the fused Trick (_fid in
// calcScore), so its chip flares and the contributions row names it.
function fusedTrickFor(partId) {
  if (typeof trickTray === 'undefined') return null;
  return trickTray.find(t => t && t.acts && t.acts.includes(partId)) || null;
}
function fusedActingFor(partId) { const t = fusedTrickFor(partId); return t ? t.id : null; }
function TB(partId) { const f = fusedActingFor(partId); return (f && BAL[f]) || BAL[partId]; }
// The carry rule (owner): the flat bonus a fused Trick brought along, and the
// count adjustment it keeps counting from.
function fusedCarry(partId, axis) { const t = fusedTrickFor(partId); return (t && t._carry && t._carry[axis]) || 0; }
function fusedCountAdj(key) {
  if (typeof trickTray === 'undefined') return 0;
  let n = 0; trickTray.forEach(t => { if (t && t.fused && t._countAdj && t._countAdj[key]) n += t._countAdj[key]; });
  return n;
}
// Pairs the player has made at least once (a collection log, not run state).
const INS_SEEN_KEY = 'lethe.inseparable.v1';
let _insSeen = null;
function inseparableSeenSet() {
  if (_insSeen) return _insSeen;
  try { _insSeen = new Set(JSON.parse(localStorage.getItem(INS_SEEN_KEY) || '[]')); } catch (e) { _insSeen = new Set(); }
  return _insSeen;
}
function pairDiscovered(fusedId) { return inseparableSeenSet().has(fusedId) || (typeof devRevealAll !== 'undefined' && devRevealAll); }
function markPairDiscovered(fusedId) {
  const s = inseparableSeenSet(); if (s.has(fusedId)) return; s.add(fusedId);
  try { localStorage.setItem(INS_SEEN_KEY, JSON.stringify([...s])); } catch (e) {}
}
function anyPairDiscovered() { return inseparableSeenSet().size > 0 || (typeof devRevealAll !== 'undefined' && devRevealAll); }
// An offer of `id` would complete a pair the player has made before: the tile jitters (css/inseparable.css).
function inseparableHint(id) { const pair = inseparablePartOf(id); return !!pair && pairDiscovered(pair.id) && inseparableCompletes(id); }

// Taking `id` would complete a pair whose other half is already owned.
function inseparableCompletes(id) {
  const pair = inseparablePartOf(id);
  if (!pair || typeof hasTrick !== 'function') return false;
  if (hasTrick(pair.id) || hasTrick(id)) return false;
  const other = pair.parts.find(x => x !== id);
  return !!other && hasTrick(other);
}
// Every pair whose two halves are both in the tray fuses now.
function inseparableCheck() {
  if (typeof INSEPARABLE_PAIRS === 'undefined' || typeof trickTray === 'undefined') return false;
  let did = false;
  INSEPARABLE_PAIRS.forEach(pair => {
    if (hasTrick(pair.id) || !pair.parts.every(id => hasTrick(id))) return;
    if (inseparableFuse(pair)) did = true;
  });
  return did;
}
function inseparableFuse(pair) {
  const def = inseparableRow(pair.id); if (!def) return false;
  const ia = trickTray.findIndex(t => t && t.id === pair.parts[0]), ib = trickTray.findIndex(t => t && t.id === pair.parts[1]);
  if (ia < 0 || ib < 0) return false;
  const pa = trickTray[ia], pb = trickTray[ib];
  const tier = Math.max(typeof entityTierOf === 'function' ? entityTierOf(pa.id) : 0, typeof entityTierOf === 'function' ? entityTierOf(pb.id) : 0);
  // r651, the carry rule (owner): half of a scaling part's earned bonus comes along
  // as a flat bonus, and a quarter of what it had counted keeps counting at the
  // fused rate (count adjustment = -3/4 of the count). Read while the parts still own.
  const carry = {}, countAdj = {};
  (pair.carry || []).forEach(c => {
    try {
      const b = c.bonus ? +c.bonus() || 0 : 0, n = c.count ? +c.count() || 0 : 0;
      if (b) carry[c.axis] = (carry[c.axis] || 0) + b / 2;
      if (c.adj && n) countAdj[c.adj] = (countAdj[c.adj] || 0) - n * 0.75;
    } catch (e) {}
  });
  const at = Math.min(ia, ib);
  trickTray.splice(Math.max(ia, ib), 1); trickTray.splice(at, 1);
  const fused = { ...def };
  if (Object.keys(carry).length) fused._carry = carry;
  if (Object.keys(countAdj).length) fused._countAdj = countAdj;
  trickTray.splice(at, 0, fused);
  // A fused line Trick keeps the line of the part that had one (the first by tray order).
  const lineOf = (typeof POSITION_ASSIGN_IDS !== 'undefined' && POSITION_ASSIGN_IDS.includes(fused.id)) ? [pa, pb].find(x => x && x._posAxis != null) : null;
  if (lineOf && typeof finalizePositionMark === 'function') { fused._posAssigned = true; finalizePositionMark(fused, lineOf._posAxis, lineOf._posIndex); }
  if (typeof markDiscovered === 'function') markDiscovered(fused.id);
  markPairDiscovered(fused.id);
  // The higher tier carries over; the parts' tiers are cleared so a part taken
  // again later starts fresh.
  if (typeof entityTier !== 'undefined') { entityTier[fused.id] = tier; delete entityTier[pa.id]; delete entityTier[pb.id]; if (typeof applyEntityTiers === 'function') applyEntityTiers(); }
  if (typeof selectTrick === 'function') selectTrick(fused, true);   // acquiredTricks, any mark (none today)
  if (typeof pruneRowColBonuses === 'function') pruneRowColBonuses();  // the parts' lines, if they had any
  if (typeof noteMessage === 'function') noteMessage(`${pa.name} + ${pb.name} are inseparable: ${fused.name}`, '#ff5a5a');
  if (typeof dbgEvent === 'function') dbgEvent(`[INSEPARABLE] ${pa.id} + ${pb.id} -> ${fused.id} (v${tier + 1})`);
  if (typeof inseparableAnimNote === 'function') inseparableAnimNote(pair, pa, pb, fused);
  return true;
}

// ── The animation: rides the improvement animation's queue and screen ────────
// (js/improve-anim.js: iaStage, iaLayer, iaTileHTML, iaType, iaWait, iaAnim...).
function inseparableAnimNote(pair, pa, pb, fused) {
  if (typeof _iaQueue === 'undefined') return;
  _iaQueue.push({ kind: 'fuse', id: fused.id, parts: [pa.id, pb.id], names: [pa.name, pb.name], desc: fused.desc });
  if (!_iaHold && !_iaRunning) { clearTimeout(_iaTimer); _iaTimer = setTimeout(() => improveAnimFlush(), 0); }
}
async function iaPlayFuse(entry) {
  const S = iaStage(); if (!S) return;
  const ent = inseparableRow(entry.id), a = inseparableRow(entry.parts[0]), b = inseparableRow(entry.parts[1]);
  if (!ent || !a || !b) return;
  const layer = iaLayer(S);
  const ctl = { skipped: false, timers: [], anims: [], resolvers: [], steps: 1,
    skip() { this.skipped = true; this.timers.forEach(clearTimeout); this.anims.forEach(x => { try { x.finish(); } catch (err) { try { x.cancel(); } catch (e2) {} } }); this.resolvers.forEach(r => r()); } };
  _iaCurrent = ctl;
  layer.classList.toggle('ia-many', _iaQueue.length > 0);
  const grid = document.getElementById('grid-slot') || document.getElementById('grid');
  const g = grid ? iaRectOf(grid, S) : { l: 0, t: 0, w: S.st.offsetWidth, h: S.st.offsetHeight };
  const chip = iaChipFor(ent.id, 'trick');
  const dst = chip ? iaRectOf(chip.querySelector('.reward-cell') || chip, S) : null;
  const size = Math.max(56, Math.min(g.w, g.h) * (iaCfg.size / 100) * 0.9);
  const tier = typeof entityTierOf === 'function' ? entityTierOf(ent.id) : 0;
  const scene = document.createElement('div'); scene.className = 'ia-scene ia-stamp ia-trick ins-scene';
  scene.style.setProperty('--ia-size', size + 'px');
  const screen = document.createElement('div'); screen.className = 'ia-screen';
  screen.style.left = g.l + 'px'; screen.style.top = g.t + 'px'; screen.style.width = g.w + 'px'; screen.style.height = g.h + 'px';
  screen.innerHTML = `<div class="ia-head">&gt; COMBINING <b class="ia-name rar-${a.tier || 'common'}">${iaEsc(a.name).toUpperCase()}</b> + <b class="ia-name rar-${b.tier || 'common'}">${iaEsc(b.name).toUpperCase()}</b></div>`
    + `<div class="ia-term"><div class="ia-ver"></div><div class="ia-desc"></div></div>`;
  const mk = (row, cls) => { const t = document.createElement('div'); t.className = 'ia-tile ' + cls; t.innerHTML = `<div class="ia-tier ia-shown">${iaTileHTML(row, 'trick', cls === 'ins-out' ? tier : 0)}</div><div class="ia-fx"></div>`; return t; };
  const tA = mk(a, 'ins-a'), tB = mk(b, 'ins-b'), tF = mk(ent, 'ins-out');
  const headH = 24, pad = 10, top = pad + headH + 6;
  [tA, tB, tF].forEach(t => { t.style.width = size + 'px'; t.style.height = size + 'px'; t.style.left = ((g.w - size) / 2) + 'px'; t.style.top = top + 'px'; screen.appendChild(t); });
  const term = screen.querySelector('.ia-term'); term.style.top = (top + size + 10) + 'px';
  const verEl = term.querySelector('.ia-ver'), descEl = term.querySelector('.ia-desc');
  scene.appendChild(screen); layer.appendChild(scene);
  const head = screen.querySelector('.ia-head');
  const off = size * 0.78;                        // where the two halves wait, either side of the middle
  const cx = g.l + g.w / 2, cy = g.t + top + size / 2;
  const to = dst ? { x: dst.l + dst.w / 2 - cx, y: dst.t + dst.h / 2 - cy, s: Math.max(0.12, dst.w / size) } : { x: 0, y: 0, s: 0.2 };
  if (chip) chip.classList.add('ia-away');
  tF.style.opacity = '0';
  try {
    iaSfx('sfxPrintFeed');
    await iaAnim(screen, [{ clipPath: 'inset(50% 0 50% 0)', opacity: .6 }, { clipPath: 'inset(0 0 0 0)', opacity: 1 }], { duration: iaMs(180), easing: 'ease-out', fill: 'forwards' }, ctl);
    iaTypeWrap(head);
    const typing = iaType(scene, head, ctl, 1);
    // the two halves come in from their sides
    const inA = iaAnim(tA, [{ transform: `translate(${-g.w / 2 - size}px, 0) scale(.6)`, opacity: 0 }, { transform: `translate(${-off}px, 0) scale(1)`, opacity: 1 }], { duration: iaMs(520), easing: 'cubic-bezier(.2,.8,.25,1)', fill: 'forwards' }, ctl);
    const inB = iaAnim(tB, [{ transform: `translate(${g.w / 2 + size}px, 0) scale(.6)`, opacity: 0 }, { transform: `translate(${off}px, 0) scale(1)`, opacity: 1 }], { duration: iaMs(520), easing: 'cubic-bezier(.2,.8,.25,1)', fill: 'forwards' }, ctl);
    await Promise.all([typing, inA, inB]);
    await iaWait(iaMs(380), ctl);
    // they lean in, then slam together
    iaSfx('sfxPrintFeed');
    const goA = iaAnim(tA, [{ transform: `translate(${-off}px, 0) scale(1)` }, { transform: `translate(${-off * 1.12}px, 0) scale(1.04)`, offset: .3 }, { transform: 'translate(0, 0) scale(1.08)', filter: 'brightness(1.8)' }], { duration: iaMs(460), easing: 'cubic-bezier(.6,0,1,.5)', fill: 'forwards' }, ctl);
    const goB = iaAnim(tB, [{ transform: `translate(${off}px, 0) scale(1)` }, { transform: `translate(${off * 1.12}px, 0) scale(1.04)`, offset: .3 }, { transform: 'translate(0, 0) scale(1.08)', filter: 'brightness(1.8)' }], { duration: iaMs(460), easing: 'cubic-bezier(.6,0,1,.5)', fill: 'forwards' }, ctl);
    await Promise.all([goA, goB]);
    // the flare: a white flash, a red ring, sparks, the screen shakes, the halves are gone and the fused tile stands
    iaSfx('sfxPrintTear'); iaSfx('sfxSuccess');
    tA.style.opacity = '0'; tB.style.opacity = '0'; tF.style.opacity = '1';
    const ring = document.createElement('div'); ring.className = 'ia-ring ins-ring'; tF.appendChild(ring);
    const sparks = document.createElement('div'); sparks.className = 'ins-sparks'; tF.appendChild(sparks);
    const sp = [];
    for (let i = 0; i < 14; i++) {
      const s = document.createElement('i'); sparks.appendChild(s);
      const ang = (i / 14) * Math.PI * 2 + (typeof fxRandom === 'function' ? fxRandom() : Math.random()) * .4;
      const d = size * (0.7 + (typeof fxRandom === 'function' ? fxRandom() : Math.random()) * .6);
      sp.push(iaAnim(s, [{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${Math.cos(ang) * d}px, ${Math.sin(ang) * d}px) scale(.2)`, opacity: 0 }], { duration: iaMs(560 + i * 18), easing: 'cubic-bezier(.1,.7,.3,1)', fill: 'forwards' }, ctl));
    }
    const r = iaAnim(ring, [{ transform: 'scale(.5)', opacity: 1 }, { transform: 'scale(2.4)', opacity: 0 }], { duration: iaMs(620), easing: 'ease-out', fill: 'forwards' }, ctl);
    const pop = iaAnim(tF, [{ transform: 'scale(.55)', filter: 'brightness(3)' }, { transform: 'scale(1.18)', filter: 'brightness(1.6)', offset: .5 }, { transform: 'scale(1)', filter: 'brightness(1)' }], { duration: iaMs(520), easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' }, ctl);
    const shake = iaAnim(screen, [{ translate: '0 0' }, { translate: '-4px 3px', offset: .2 }, { translate: '4px -2px', offset: .45 }, { translate: '-2px 1px', offset: .7 }, { translate: '0 0' }], { duration: iaMs(360), easing: 'ease-out' }, ctl);
    await Promise.all([r, pop, shake, iaFlash(tF, ctl, 320, 1), ...sp]);
    ring.remove(); sparks.remove();
    // the line
    verEl.innerHTML = `INSEPARABLE: <b class="ins-name">${iaEsc(ent.name).toUpperCase()}</b>${tier ? ` v${tier + 1}.0` : ''}`;
    descEl.innerHTML = `<span class="ia-whole">${iaEsc(entry.desc || ent.desc || '')}</span>`;
    iaTypeWrap(verEl); iaTypeWrap(descEl);
    await iaType(scene, verEl, ctl, 1); await iaType(scene, descEl, ctl, 1);
    await iaWait(iaMs(iaCfg.hold + 300), ctl);
    await iaAnim(tF, [{ transform: 'translate(0, 0) scale(1)', opacity: 1 }, { transform: `translate(${to.x}px, ${to.y}px) scale(${to.s})`, opacity: to.s < 0.2 ? 0 : 1 }], { duration: iaMs(400), easing: 'cubic-bezier(.5,0,.7,.3)', fill: 'forwards' }, ctl);
    iaSfx('sfxPrintFeed');
    await iaAnim(screen, [{ clipPath: 'inset(0 0 0 0)', opacity: 1 }, { clipPath: 'inset(50% 0 50% 0)', opacity: .5 }], { duration: iaMs(150), easing: 'ease-in', fill: 'forwards' }, ctl);
  } finally {
    scene.remove();
    if (chip) { chip.classList.remove('ia-away'); const tray = chip.closest('#trick-tray-area, .tray'); if (tray && typeof trayFxKick === 'function') trayFxKick(tray, 'in'); }
    _iaCurrent = null;
  }
}

// ── Dev / preview: dev -> Bonuses -> "Preview inseparable" plays the scene without fusing ──
async function inseparablePreview() {
  const pair = (typeof INSEPARABLE_PAIRS !== 'undefined') && INSEPARABLE_PAIRS[0]; if (!pair) return;
  const a = inseparableRow(pair.parts[0]), b = inseparableRow(pair.parts[1]), f = inseparableRow(pair.id);
  if (!a || !b || !f) return;
  _iaQueue.push({ kind: 'fuse', id: f.id, parts: [a.id, b.id], names: [a.name, b.name], desc: f.desc });
  await improveAnimFlush();
}
