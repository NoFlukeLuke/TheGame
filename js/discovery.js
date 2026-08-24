// ══════════════════════════════════════════════════════════════════════════
// PERSONNEL FILE — what the player has actually met, and what they aren't
// cleared to see yet. Drives the Builds archive's three states.
//
//   DISCOVERED    — acquired at least once in a run. Full record visible.
//   FILE MISSING  — never acquired. The entity exists but its record is blank.
//   AUTHORIZATION — gated behind a task. You can see there IS a file; not what's
//     REQUIRED      in it. (The task system isn't built yet — ENTITY_LOCKS is the
//                    hook it will populate.)
//
// Discovery is recorded whenever an entity is granted, from any source: shop,
// wheel, reward grid, event. Persisted across runs — it's a collection log, not
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

// Entities gated behind a task. Shape: { id: 'reach act 3 without discarding' }.
// Empty for now — the unlock-task system will fill it. Anything listed here reads
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
  const task = ENTITY_LOCKS[id];
  return !!task && !unlockedTasks.has(task);
}
function lockTaskFor(id) { return ENTITY_LOCKS[id] || null; }

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
// in several places, so there is no single choke point to hook — but everything
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
