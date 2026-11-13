// ══════════════════════════════════════════════════════════════════════════════
// STACKED (r685, owner). A knack.
// ══════════════════════════════════════════════════════════════════════════════
// Every BAL.stacked.seconds of a round's time (the marks Understudy counts by,
// from the round tick), each Sleight on the grid has BAL.stacked.chance to prime
// the Trick in the tray slot of its column: a Sleight in column 2 primes the
// second Trick. Source `stacked` (Quarter resource limits apply). The ladder
// alternates +10% and -10s; v6 does both, the time stopping at 5s.

let stackedLvl = null, stackedBlock = 0;

function stackedTick(elapsed) {
  if (typeof hasKnack !== 'function' || !hasKnack('stacked') || !BAL.stacked) return;
  if (stackedLvl !== level) { stackedLvl = level; stackedBlock = 0; }
  const blk = Math.floor(Math.max(0, elapsed) / Math.max(1, BAL.stacked.seconds));
  if (blk <= stackedBlock) return;
  stackedBlock = blk;
  if (animating || falling || roundEnded) return;
  const primed = [];
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const cd = gridData[r]?.[c];
    if (!cd || !cd._isSleight || Math.random() >= BAL.stacked.chance) continue;
    const t = trickTray[c];
    if (!t || (typeof isTrickDisabledByBoss === 'function' && isTrickDisabledByBoss(t.id))) continue;
    if (!primeTrick(t, 1, { src: 'stacked' })) continue;
    primed.push(t.name);
    const el = document.querySelector(`#grid [data-card-id="${cd._id}"]`);
    if (el) {
      el.classList.remove('stk-fire'); void el.offsetWidth; el.classList.add('stk-fire');
      setTimeout(() => el.classList.remove('stk-fire'), 900);
      if (typeof efxFly === 'function') efxFly(el, 'tricks', '+1 PRIME', '#b48cff', 'tricks', 1);
    }
  }
  if (!primed.length) return;
  if (typeof renderTrickTray === 'function') renderTrickTray();
  const k = acquiredKnacks.find(x => x && x.id === 'stacked');
  const n = {}; primed.forEach(x => { n[x] = (n[x] || 0) + 1; });
  showMessage(`${k ? k.name : 'Stacked'}: ${Object.keys(n).map(x => n[x] > 1 ? `${x} ×${n[x]}` : x).join(', ')} primed`, '#b48cff');
}
