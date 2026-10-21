// ══════════════════════════════════════════════════════════════════════════
// FINALE (r634, owner) - the run's end over the board, Balatro's way: one
// panel that says how it went and what you had, with the board still behind
// it (hold PEEK). Replaces #end-overlay's report for a win, a loss, a clock
// out and a BUILDS test drive.
//
//   how close    the last round's score against its goal, as a bar
//   best hand    the biggest hand of the run
//   most used    the Trick that fired in the most hands (trickFireTotals,
//                js/play-hand.js)
//   the rest     rounds cleared, hands, time, credits, cards scored and
//                discarded, the quarter table (js/quarter.js) under DETAILS
//   loadout      every Trick, Sleight and Knack held, as tiles
//   SAVE BUILD   writes the loadout to BUILDS' saved builds (js/builds.js)
// ══════════════════════════════════════════════════════════════════════════

function finaleOwned() {
  const tricks = (typeof trickTray !== 'undefined' && trickTray ? trickTray : []).filter(t => t && t.id);
  const knacks = (typeof acquiredKnacks !== 'undefined' && acquiredKnacks ? acquiredKnacks : []).filter(k => k && k.id);
  const seen = new Set(), sleights = [];
  const take = c => { if (c && c._isSleight && !seen.has(c.sleightId)) { seen.add(c.sleightId); const d = SLEIGHT_POOL.find(s => s.id === c.sleightId); if (d) sleights.push(d); } };
  try {
    [...(drawPile || []), ...(playedPile || [])].forEach(take);
    for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) take(gridData[r]?.[c]);
  } catch (e) {}
  return { tricks, knacks, sleights };
}
function finaleTile(e, type) {
  const g = type === 'trick' ? trickEmoji(e) : (e.emoji || '♦');
  const rar = tierId(type === 'trick' ? e.tier : e.rarity);
  return `<span class="fn-tile" title="${e.name}">${entityTileHTML({ entity: type, id: e.id, emoji: g, label: e.name }, rar, { tip: true })}</span>`;
}
function finaleClock(sec) { const m = Math.floor(sec / 60), s = sec % 60; return `${m}:${s < 10 ? '0' : ''}${s}`; }

function showFinale(kind) {
  // A test drive ends here whatever ended it: the goal, the clock, a loss.
  if (typeof testDriveActive === 'function' && testDriveActive()) kind = 'drive';
  const won = kind === 'win';
  const drive = kind === 'drive';
  const sc = typeof score === 'number' ? score : 0;
  const goal = typeof roundGoal === 'number' && roundGoal > 0 ? roundGoal : 0;
  const cleared = won || drive && sc >= goal;
  const pct = goal ? Math.min(100, Math.round(sc / goal * 100)) : 100;
  const title = won ? 'VICTORY' : drive ? (cleared ? 'TEST DRIVE CLEARED' : 'TEST DRIVE OVER') : kind === 'timeup' ? "TIME'S UP" : 'GAME OVER';
  const owned = finaleOwned();
  const secs = Math.max(0, Math.floor((Date.now() - (typeof gameStartTime === 'number' && gameStartTime ? gameStartTime : Date.now())) / 1000));

  // The Trick that fired in the most hands.
  let most = null;
  const tot = (typeof trickFireTotals !== 'undefined' && trickFireTotals) ? trickFireTotals : {};
  Object.keys(tot).forEach(id => { if (!most || tot[id] > tot[most]) most = id; });
  const mostDef = most ? (owned.tricks.find(t => t.id === most) || TRICK_POOL_ALL.find(t => t.id === most)) : null;

  const closeLine = cleared
    ? `<b>${sc.toLocaleString()}</b> of <b>${goal.toLocaleString()}</b> · cleared`
    : goal ? `<b>${sc.toLocaleString()}</b> of <b>${goal.toLocaleString()}</b> · short by <b>${(goal - sc).toLocaleString()}</b> (${pct}%)` : '';
  const tile = (label, value, sub) => `<div class="fn-stat"><span>${label}</span><b>${value}</b>${sub ? `<i>${sub}</i>` : ''}</div>`;
  const lvl = typeof level === 'number' ? level : 0;

  let el = document.getElementById('finale');
  if (!el) { el = document.createElement('div'); el.id = 'finale'; document.body.appendChild(el); }
  el.className = 'fn-' + kind;
  el.innerHTML = `
    <div class="fn-panel">
      <div class="fn-title">${title}</div>
      <div class="fn-mode">${(typeof ACTIVE_MODE !== 'undefined' && ACTIVE_MODE) ? ACTIVE_MODE.name : ''}${drive && testDrive && testDrive.name ? ' · ' + testDrive.name : ''}</div>
      <div class="fn-close">
        <div class="fn-close-head">${drive ? 'THE ROUND' : 'LAST ROUND'} ${lvl + (cleared && !drive ? 0 : 1)}</div>
        <div class="fn-bar"><div class="fn-bar-fill" style="width:${pct}%"></div></div>
        <div class="fn-close-line">${closeLine}</div>
      </div>
      <div class="fn-stats">
        ${tile('Rounds cleared', lvl)}
        ${tile('Hands played', typeof handsPlayed === 'number' ? handsPlayed : 0)}
        ${tile('Best hand', (typeof highestHandName === 'string' && highestHandName) ? highestHandName : '·', highestHandScore ? highestHandScore.toLocaleString() : '')}
        ${tile('Time played', finaleClock(secs))}
        ${tile('Credits', (typeof coins === 'number' ? coins : 0) + ' &#9670;')}
        ${tile('Cards scored', typeof cardsScoredTotal === 'number' ? cardsScoredTotal : 0, (typeof cardsDiscardedTotal === 'number' ? cardsDiscardedTotal : 0) + ' discarded')}
      </div>
      <div class="fn-most">
        <div class="fn-most-head">MOST USED</div>
        ${mostDef ? `${finaleTile(mostDef, 'trick')}<div class="fn-most-text"><b>${mostDef.name}</b><i>fired in ${tot[most]} hand${tot[most] === 1 ? '' : 's'}</i></div>` : '<div class="fn-most-text"><i>no Trick fired</i></div>'}
      </div>
      <div class="fn-load">
        <div class="fn-load-head">THE BUILD <span>${owned.tricks.length + owned.sleights.length + owned.knacks.length}</span></div>
        <div class="fn-load-row">${owned.tricks.map(t => finaleTile(t, 'trick')).join('')}${owned.sleights.map(s => finaleTile(s, 'sleight')).join('')}${owned.knacks.map(k => finaleTile(k, 'knack')).join('')}${owned.tricks.length + owned.sleights.length + owned.knacks.length ? '' : '<i>nothing held</i>'}</div>
      </div>
      <details class="fn-details"><summary>DETAILS</summary>${(typeof runReportHTML === 'function') ? runReportHTML() : ''}</details>
      <div class="fn-keys">
        <button class="fn-key" id="fn-peek">PEEK</button>
        <button class="fn-key" id="fn-save">SAVE BUILD</button>
        ${drive ? `<button class="fn-key fn-primary" id="fn-builds">BACK TO BUILDS</button>` : `<button class="fn-key fn-primary" id="fn-again">PLAY AGAIN</button>`}
        <button class="fn-key" id="fn-home">HOME</button>
      </div>
    </div>`;
  el.classList.add('show');

  // PEEK: hold to see the board; a tap toggles for a thumb.
  const peek = el.querySelector('#fn-peek');
  let held = false, tapped = false;
  const on = () => el.classList.add('peek'), off = () => { if (!tapped) el.classList.remove('peek'); };
  peek.addEventListener('pointerdown', e => { held = true; on(); e.preventDefault(); });
  const up = () => { if (held) { held = false; off(); } };
  peek.addEventListener('pointerup', up); peek.addEventListener('pointercancel', up); peek.addEventListener('pointerleave', up);
  peek.addEventListener('click', () => { tapped = !tapped; el.classList.toggle('peek', tapped); peek.classList.toggle('on', tapped); });

  el.querySelector('#fn-save').onclick = () => {
    const name = prompt('Name this build:', (drive && testDrive && testDrive.name) || `${(ACTIVE_MODE && ACTIVE_MODE.name) || 'Run'} ${new Date().toLocaleDateString()}`);
    if (name == null) return;
    const rec = saveBuildRecord({ name, tricks: owned.tricks.map(t => t.id), sleights: owned.sleights.map(s => s.id), knacks: owned.knacks.map(k => k.id) });
    el.querySelector('#fn-save').textContent = `SAVED “${rec.name}”`;
  };
  const again = el.querySelector('#fn-again'); if (again) again.onclick = () => { el.classList.remove('show'); startGame(); };
  const back = el.querySelector('#fn-builds'); if (back) back.onclick = () => { try { sessionStorage.setItem('lethe.openBuilds.v1', '1'); } catch (e) {} location.reload(); };
  el.querySelector('#fn-home').onclick = () => location.reload();
}

// ── pause menu: pick a saved build to track (r634) ──────────────────────────
function pauseBuildsToggle() {
  const box = document.getElementById('pause-builds'); if (!box) return;
  if (box.style.display !== 'none') { box.style.display = 'none'; return; }
  const list = (typeof loadSavedBuilds === 'function') ? loadSavedBuilds() : [];
  const filed = (typeof filedRequisitionName === 'function') ? filedRequisitionName() : '';
  box.innerHTML = list.length
    ? `<div class="pb-head">TRACK A BUILD</div>` + [['', 'none'], ...list.map(b => [b.name, b.name])].map(([v, l]) =>
        `<label class="pb-row ${filed === v ? 'on' : ''}"><input type="radio" name="pb" value="${v.replace(/"/g, '&quot;')}" ${filed === v ? 'checked' : ''}><span>${l}</span></label>`).join('')
      + `<div class="pb-note">A tracked build stars its Tricks, Sleights and Knacks on every offer.</div>`
    : `<div class="pb-note">No saved builds. Make one in BUILDS on the main menu, or SAVE BUILD at a run's end.</div>`;
  box.style.display = 'block';
  box.querySelectorAll('input[name=pb]').forEach(r => r.onchange = () => { setFiledRequisition(r.value); box.querySelectorAll('.pb-row').forEach(x => x.classList.toggle('on', x.querySelector('input').checked)); });
  if (typeof placePauseMenu === 'function') placePauseMenu();
}
