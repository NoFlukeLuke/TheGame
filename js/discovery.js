// ══════════════════════════════════════════════════════════════════════════
// PERSONNEL FILE - what the player has actually met, and what they aren't
// cleared to see yet. Drives the Builds archive's three states.
//
//   DISCOVERED    - acquired at least once in a run. Full record visible.
//   FILE MISSING  - never acquired. The entity exists but its record is blank.
//   AUTHORIZATION - gated behind a task. You can see there IS a file; not what's
//     REQUIRED      in it. (The task system isn't built yet - ENTITY_LOCKS is the
//                    hook it will populate.)
//
// Discovery is recorded whenever an entity is granted, from any source: shop,
// wheel, reward grid, event. Persisted across runs - it's a collection log, not
// run state.
// ══════════════════════════════════════════════════════════════════════════

let discoveredIds = new Set();
try {
  const raw = JSON.parse(localStorage.getItem('discoveredIds') || '[]');
  if (Array.isArray(raw)) discoveredIds = new Set(raw);
} catch (e) {}

function saveDiscovered() {
  try { localStorage.setItem('discoveredIds', JSON.stringify([...discoveredIds])); } catch (e) {}
}

// Call whenever the player actually obtains an entity.
function markDiscovered(id) {
  if (!id || discoveredIds.has(id)) return;
  discoveredIds.add(id);
  saveDiscovered();
}
function isDiscovered(id) { return discoveredIds.has(id); }

// r651 (owner): a rare or epic Trick, and every fused (INSEPARABLE) Trick, keeps
// its NAME to itself until it has been taken once: offers, tooltips and Builds
// print UNDISCOVERED_NAME instead. The description still shows, so a buy is a
// known thing with an unknown name. Commons, legendaries, Sleights and Knacks
// print their names. Dev reveal (devRevealAll) shows everything.
const UNDISCOVERED_NAME = 'UNDISCOVERED';
function nameHidden(def, type) {
  if (!def || !def.id) return false;
  if (typeof devRevealAll !== 'undefined' && devRevealAll) return false;
  if ((type || 'trick') !== 'trick') return false;
  const tier = def.tier || def.rarity;
  if (!(def.fused || tier === 'rare' || tier === 'epic')) return false;
  return !isDiscovered(def.id);
}
function shownEntityName(def, type) { return nameHidden(def, type) ? UNDISCOVERED_NAME : (def && def.name) || ''; }

// Entities gated behind a task. Shape: { id: 'reach act 3 without discarding' }.
// Empty for now - the unlock-task system will fill it. Anything listed here reads
// as AUTHORIZATION REQUIRED until its task is recorded in unlockedTasks.
const ENTITY_LOCKS = {};

let unlockedTasks = new Set();
try {
  const raw = JSON.parse(localStorage.getItem('unlockedTasks') || '[]');
  if (Array.isArray(raw)) unlockedTasks = new Set(raw);
} catch (e) {}
function completeTask(taskId) {
  if (!taskId || unlockedTasks.has(taskId)) return;
  unlockedTasks.add(taskId);
  try { localStorage.setItem('unlockedTasks', JSON.stringify([...unlockedTasks])); } catch (e) {}
}
function isLocked(id) {
  if (typeof trickLocked === 'function' && trickLocked(id)) return true;   // r706: Trick unlock goals (js/unlocks.js)
  const task = ENTITY_LOCKS[id];
  return !!task && !unlockedTasks.has(task);
}
function lockTaskFor(id) {
  if (typeof trickLocked === 'function' && trickLocked(id)) return unlockGoalText(id, true);
  return ENTITY_LOCKS[id] || null;
}

// The archive's view of one entity. 'open' | 'missing' | 'classified'.
// devRevealAll flips everything to 'open' so the owner can browse the real thing.
let devRevealAll = localStorage.getItem('devRevealAll') === 'true';
function setDevRevealAll(on) {
  devRevealAll = !!on;
  try { localStorage.setItem('devRevealAll', devRevealAll ? 'true' : 'false'); } catch (e) {}
}
function fileState(id) {
  if (devRevealAll) return 'open';
  if (isLocked(id)) return 'classified';
  return isDiscovered(id) ? 'open' : 'missing';
}

// ── recording ───────────────────────────────────────────────────────────────
// A sweep, not wrappers. Knacks are granted by inline `acquiredKnacks.push(...)`
// in several places, so there is no single choke point to hook - but everything
// the player owns is reachable from four arrays. Sweeping them catches every
// grant path (shop, wheel, reward grid, events) and can't drift when a new one
// is added. Cheap enough to call on every round start and shop render.
function syncDiscoveredFromOwned() {
  let added = false;
  const add = id => { if (id && !discoveredIds.has(id)) { discoveredIds.add(id); added = true; } };
  try {
    (typeof trickTray      !== 'undefined' ? trickTray      : []).forEach(t => add(t && t.id));
    (typeof acquiredTricks !== 'undefined' ? acquiredTricks : []).forEach(t => add(t && t.id));
    (typeof acquiredKnacks !== 'undefined' ? acquiredKnacks : []).forEach(k => add(k && k.id));
    if (typeof ownedSleightCards === 'function') ownedSleightCards().forEach(c => add(c && c.sleightId));
  } catch (e) {}
  if (added) saveDiscovered();
}

// ── THE REVEAL (r706, owner: "might help people remember the Tricks") ─────────
// The first time a hidden-name Trick is taken, its name is revealed on the
// improvement animation's screen: the tile arrives, "UNDISCOVERED" types and is
// struck, the real name types over it, then the sentence, then the tile goes to
// its tray chip. It rides the same queue (kind 'reveal'), so FAST FORWARD and
// Settings -> Skip -> Screen transitions cover it, and a reward grid's confirm
// holds it until the grid is done. injectTrickAfterReward calls revealNote
// before it marks the Trick discovered.
function revealNote(def) {
  if (!def || !def.id || typeof _iaQueue === 'undefined') return;
  if (typeof unlockPaused === 'function' && unlockPaused()) return;
  if (!nameHidden(def, 'trick')) return;
  _iaQueue.push({ kind: 'reveal', id: def.id });
  if (!_iaHold && !_iaRunning) { clearTimeout(_iaTimer); _iaTimer = setTimeout(() => improveAnimFlush(), 0); }
}
async function iaPlayReveal(entry) {
  const S = iaStage(); if (!S) return;
  const found = iaEntity(entry.id); if (!found) return;
  const ent = found.e;
  const layer = iaLayer(S);
  const ctl = { skipped: false, timers: [], anims: [], resolvers: [], steps: 1,
    skip() { this.skipped = true; this.timers.forEach(clearTimeout); this.anims.forEach(a => { try { a.finish(); } catch (err) { try { a.cancel(); } catch (e2) {} } }); this.resolvers.forEach(r => r()); } };
  _iaCurrent = ctl;
  layer.classList.toggle('ia-many', _iaQueue.length > 0);
  const grid = document.getElementById('grid-slot') || document.getElementById('grid');
  const g = grid ? iaRectOf(grid, S) : { l: 0, t: 0, w: S.st.offsetWidth, h: S.st.offsetHeight };
  const chip = iaChipFor(ent.id, 'trick');
  const dst = chip ? iaRectOf(chip.querySelector('.reward-cell') || chip, S) : null;
  const size = Math.max(56, Math.min(g.w, g.h) * (iaCfg.size / 100));
  const rar = ent.tier || 'common';
  const tier = typeof entityTierOf === 'function' ? entityTierOf(ent.id) : 0;
  const scene = document.createElement('div'); scene.className = 'ia-scene ia-stamp ia-trick rv-scene';
  scene.style.setProperty('--ia-size', size + 'px');
  const screen = document.createElement('div'); screen.className = 'ia-screen';
  screen.style.left = g.l + 'px'; screen.style.top = g.t + 'px'; screen.style.width = g.w + 'px'; screen.style.height = g.h + 'px';
  screen.innerHTML = `<div class="ia-head">&gt; FILE FOUND</div><div class="ia-term"><div class="ia-ver rv-name"><span class="rv-old">${UNDISCOVERED_NAME}</span></div><div class="ia-desc"></div></div>`;
  const tile = document.createElement('div'); tile.className = 'ia-tile';
  tile.innerHTML = `<div class="ia-tier ia-shown">${iaTileHTML(ent, 'trick', tier)}</div><div class="ia-fx"></div>`;
  const headH = 24, pad = 10, top = pad + headH + 6;
  tile.style.width = size + 'px'; tile.style.height = size + 'px'; tile.style.left = ((g.w - size) / 2) + 'px'; tile.style.top = top + 'px';
  screen.appendChild(tile); scene.appendChild(screen); layer.appendChild(scene);
  const head = screen.querySelector('.ia-head'), term = screen.querySelector('.ia-term');
  term.style.top = (top + size + 10) + 'px';
  const nameEl = term.querySelector('.rv-name'), oldEl = nameEl.querySelector('.rv-old'), descEl = term.querySelector('.ia-desc');
  const cx = g.l + g.w / 2, cy = g.t + top + size / 2;
  const to = dst ? { x: dst.l + dst.w / 2 - cx, y: dst.t + dst.h / 2 - cy, s: Math.max(0.12, dst.w / size) } : { x: 0, y: 0, s: 0.2 };
  if (chip) chip.classList.add('ia-away');
  try {
    iaSfx('sfxPrintFeed');
    await iaAnim(screen, [{ clipPath: 'inset(50% 0 50% 0)', opacity: .6 }, { clipPath: 'inset(0 0 0 0)', opacity: 1 }], { duration: iaMs(180), easing: 'ease-out', fill: 'forwards' }, ctl);
    iaTypeWrap(head);
    const pop = iaAnim(tile, [{ transform: 'scale(.4)', opacity: 0, filter: 'brightness(0)' }, { transform: 'scale(1.1)', opacity: 1, filter: 'brightness(.4)', offset: .6 }, { transform: 'scale(1)', opacity: 1, filter: 'brightness(.4)' }], { duration: iaMs(420), easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' }, ctl);
    await Promise.all([iaType(scene, head, ctl, 1), pop]);
    iaTypeWrap(oldEl); await iaType(scene, oldEl, ctl, 1);
    await iaWait(iaMs(320), ctl);
    // struck, then the real name types over it and the tile lights
    oldEl.classList.add('rv-struck'); iaSfx('sfxPrintTear');
    await iaWait(iaMs(260), ctl);
    oldEl.remove();
    const nm = document.createElement('b'); nm.className = `ia-name rar-${rar}`; nm.textContent = String(ent.name).toUpperCase(); nameEl.appendChild(nm);
    iaTypeWrap(nm);
    const lit = iaAnim(tile, [{ transform: 'scale(1)', filter: 'brightness(.4)' }, { transform: 'scale(1.12)', filter: 'brightness(2)', offset: .35 }, { transform: 'scale(1)', filter: 'brightness(1)' }], { duration: iaMs(520), easing: 'ease-out', fill: 'forwards' }, ctl);
    iaSfx('sfxSuccess');
    await Promise.all([iaType(scene, nm, ctl, 1), lit, iaFlash(tile, ctl, 320, 1)]);
    descEl.innerHTML = `<span class="ia-whole">${iaEsc(ent.desc || '')}</span>`;
    iaTypeWrap(descEl); await iaType(scene, descEl, ctl, 1);
    await iaWait(iaMs(iaCfg.hold), ctl);
    await iaAnim(tile, [{ transform: 'translate(0, 0) scale(1)', opacity: 1 }, { transform: `translate(${to.x}px, ${to.y}px) scale(${to.s})`, opacity: to.s < 0.2 ? 0 : 1 }], { duration: iaMs(400), easing: 'cubic-bezier(.5,0,.7,.3)', fill: 'forwards' }, ctl);
    iaSfx('sfxPrintFeed');
    await iaAnim(screen, [{ clipPath: 'inset(0 0 0 0)', opacity: 1 }, { clipPath: 'inset(50% 0 50% 0)', opacity: .5 }], { duration: iaMs(150), easing: 'ease-in', fill: 'forwards' }, ctl);
  } finally {
    scene.remove();
    if (chip) { chip.classList.remove('ia-away'); const tray = chip.closest('#trick-tray-area, .tray'); if (tray && typeof trayFxKick === 'function') trayFxKick(tray, 'in'); }
    _iaCurrent = null;
  }
}
