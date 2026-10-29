// ══════════════════════════════════════════════════════════════════════════
// FINALE (r634; r680 owner: on the board, in the command-line look) - the
// run's end as a board screen (js/board-screen.js), the way the events, the
// quarter card and the briefing are. It says what a player is proudest of or
// most curious about, in this order:
//
//   the headline   VICTORY / GAME OVER / TIME'S UP, the mode, how far
//   records        NEW BEST tags against the run history (js/history.js):
//                  total score, best hand, deepest round, most hands
//   the numbers    total score, best hand (name + score), most played hand
//                  (crHandPlays), most used Trick (trickFireTotals), hands,
//                  credits, cards scored / discarded, time
//   the build      every Trick, Knack and Sleight held, as tiles with names
//   details        the quarter table (js/quarter.js runReportHTML)
//
// Keys: PLAY = PLAY AGAIN (BACK TO BUILDS on a test drive), DISCARD = HOME,
// SWAP = ENDLESS on a won run that can go on (js/endless.js). On the screen:
// PEEK (the board under it), SHARE (js/finale-share.js: a PNG of the result
// and the build, shared, copied or saved; EXPAND puts every entity on it),
// SAVE BUILD (a name field on the screen, then js/builds.js), DETAILS.
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
function finaleGlyph(e, type) { return type === 'trick' ? trickEmoji(e) : (e.emoji || '♦'); }
function finaleRarity(e, type) { return tierId(type === 'trick' ? e.tier : e.rarity); }
function finaleTile(e, type) {
  const g = finaleGlyph(e, type), rar = finaleRarity(e, type);
  return `<span class="fn-tile" title="${(e.name || '').replace(/"/g, '&quot;')}">${entityTileHTML({ entity: type, id: e.id, emoji: g, label: e.name }, rar, { tip: true })}<i class="fn-tname">${e.name || ''}</i></span>`;
}
function finaleClock(sec) { const m = Math.floor(sec / 60), s = sec % 60; return `${m}:${s < 10 ? '0' : ''}${s}`; }

// Everything the screen and the share image print, in one place.
function finaleFacts(kind) {
  if (typeof testDriveActive === 'function' && testDriveActive()) kind = 'drive';
  const won = kind === 'win', drive = kind === 'drive';
  const endless = !!((typeof endlessRun !== 'undefined' && endlessRun) || (typeof survivalEndless !== 'undefined' && survivalEndless));
  const sc = typeof score === 'number' ? score : 0;
  const goal = typeof roundGoal === 'number' && roundGoal > 0 ? roundGoal : 0;
  const cleared = won || (drive && sc >= goal);
  const total = (typeof totalScore === 'number' ? totalScore : 0) + sc;
  const lvl = typeof level === 'number' ? level : 0;
  const act = typeof actNumber === 'number' ? actNumber : 0;
  const actMode = typeof isActMode === 'function' && isActMode();
  const secs = Math.max(0, Math.floor((Date.now() - (typeof gameStartTime === 'number' && gameStartTime ? gameStartTime : Date.now())) / 1000));
  const owned = finaleOwned();
  const title = drive ? (cleared ? 'TEST DRIVE CLEARED' : 'TEST DRIVE OVER')
    : won ? 'VICTORY' : endless ? 'ENDLESS OVER' : kind === 'timeup' ? "TIME'S UP" : 'GAME OVER';
  const mode = (typeof ACTIVE_MODE !== 'undefined' && ACTIVE_MODE) ? ACTIVE_MODE.name : '';
  // How far: a quarter mode counts quarters (a won run closed its last one), Flow its bosses.
  let far = '';
  if (drive) far = 'ONE ROUND';
  else if (actMode) far = won ? `Q${Math.max(1, act - 1)} CLOSED` : `REACHED Q${act}`;
  else if (typeof survivalBossesBeaten === 'number' && (typeof survivalActive === 'function' && survivalActive())) far = `${survivalBossesBeaten} BOSS${survivalBossesBeaten === 1 ? '' : 'ES'} BEATEN`;
  const rounds = Math.max(0, won ? lvl : lvl - 1);
  // The Trick that fired in the most hands.
  let most = null;
  const tot = (typeof trickFireTotals !== 'undefined' && trickFireTotals) ? trickFireTotals : {};
  Object.keys(tot).forEach(id => { if (!most || tot[id] > tot[most]) most = id; });
  const mostDef = most ? (owned.tricks.find(t => t.id === most) || TRICK_POOL_ALL.find(t => t.id === most)) : null;
  // The hand played most (crHandPlays counts every hand played, js/challenge-round.js).
  let hand = null;
  const hp = (typeof crHandPlays === 'object' && crHandPlays) ? crHandPlays : {};
  Object.keys(hp).forEach(h => { if (!hand || hp[h] > hp[hand]) hand = h; });
  // Personal bests against every earlier run (the run's own history entry excluded).
  const hist = (typeof readRunHistory === 'function') ? readRunHistory().filter(r => r.startedAt !== gameStartTime) : [];
  const prev = {
    score: hist.reduce((m, r) => Math.max(m, r.score || 0), 0),
    hand: hist.reduce((m, r) => Math.max(m, r.bestHandScore || 0), 0),
    level: hist.reduce((m, r) => Math.max(m, r.level || 0), 0),
    hands: hist.reduce((m, r) => Math.max(m, r.hands || 0), 0),
    wins: hist.filter(r => r.outcome === 'win').length,
  };
  const bestHandScore = typeof highestHandScore === 'number' ? highestHandScore : 0;
  const hands = typeof handsPlayed === 'number' ? handsPlayed : 0;
  const records = [];
  if (!drive && hist.length) {
    if (total > prev.score) records.push('BEST SCORE');
    if (bestHandScore > prev.hand) records.push('BEST HAND');
    if (lvl > prev.level) records.push('DEEPEST RUN');
    if (hands > prev.hands) records.push('MOST HANDS');
  }
  if (won && !drive && !prev.wins) records.push('FIRST WIN');
  return {
    kind, won, drive, endless, cleared, title, mode, far, rounds, lvl, act, secs, owned, total, sc, goal,
    bestHand: (typeof highestHandName === 'string' && highestHandName) ? highestHandName : null, bestHandScore,
    hand, handCount: hand ? hp[hand] : 0, mostDef, mostCount: most ? tot[most] : 0, hands,
    credits: typeof coins === 'number' ? coins : 0,
    scored: typeof cardsScoredTotal === 'number' ? cardsScoredTotal : 0,
    discarded: typeof cardsDiscardedTotal === 'number' ? cardsDiscardedTotal : 0,
    records, firstRun: !hist.length,
    coll: (typeof collectionGained === 'function') ? collectionGained() : null,   // r706
    seed: (typeof runSeed === 'string' && runSeed) ? runSeed : null,
    date: new Date().toLocaleDateString(),
  };
}

let _fnCtl = null, _fnFacts = null;
function finaleBodyHTML(F) {
  const box = (label, value, sub, rec) => `<div class="bs-line fn-stat${rec ? ' fn-rec' : ''}"><b>${label}</b><span class="fn-val">${value}</span>${sub ? `<small>${sub}</small>` : ''}${rec ? '<em>NEW BEST</em>' : ''}</div>`;
  const r = F.records;
  const closeLine = F.drive
    ? `<b>${F.sc.toLocaleString()}</b> of <b>${F.goal.toLocaleString()}</b> · ${F.cleared ? 'cleared' : 'short'}`
    : F.won ? `${F.far} · ${F.rounds} ROUND${F.rounds === 1 ? '' : 'S'} · ${finaleClock(F.secs)}`
    : `${F.far} · ROUND ${F.lvl}${F.goal ? ` · <b>${F.sc.toLocaleString()}</b> of <b>${F.goal.toLocaleString()}</b>` : ''} · ${finaleClock(F.secs)}`;
  const n = F.owned.tricks.length + F.owned.knacks.length + F.owned.sleights.length;
  return `
    <div class="bs-note fn-close">${closeLine}${F.records.length ? `<div class="fn-records">${F.records.map(x => `<span>★ ${x}</span>`).join('')}</div>` : ''}</div>
    <div class="bs-lines fn-stats">
      ${box('SCORE', F.total.toLocaleString(), '', r.includes('BEST SCORE'))}
      ${box('BEST HAND', F.bestHand || '·', F.bestHandScore ? F.bestHandScore.toLocaleString() : '', r.includes('BEST HAND'))}
      ${box('MOST PLAYED', F.hand || '·', F.hand ? `${F.handCount} time${F.handCount === 1 ? '' : 's'}` : '')}
      ${box('MOST USED', F.mostDef ? F.mostDef.name : '·', F.mostDef ? `fired in ${F.mostCount} hand${F.mostCount === 1 ? '' : 's'}` : 'no Trick fired')}
      ${box('HANDS', F.hands, '', r.includes('MOST HANDS'))}
      ${box('CREDITS', (typeof creditsTxt === 'function') ? creditsTxt(F.credits) : F.credits)}
      ${box('CARDS', F.scored, `${F.discarded} discarded`)}
      ${box('TIME', finaleClock(F.secs))}
      ${F.coll ? box('COLLECTION', `${F.coll.now.found} / ${F.coll.now.all}`, [F.coll.found ? `+${F.coll.found} found` : '', F.coll.unlocked ? `+${F.coll.unlocked} unlocked` : '', F.coll.pairs ? `+${F.coll.pairs} inseparable` : ''].filter(Boolean).join(' · ') || 'Tricks found') : ''}
    </div>
    <div class="fn-load"><div class="bs-sub">THE BUILD · ${n}</div>
      <div class="fn-load-row">${F.owned.tricks.map(t => finaleTile(t, 'trick')).join('')}${F.owned.knacks.map(k => finaleTile(k, 'knack')).join('')}${F.owned.sleights.map(s => finaleTile(s, 'sleight')).join('')}${n ? '' : '<i>nothing held</i>'}</div>
    </div>
    <div class="fn-details" hidden>${(typeof runReportHTML === 'function') ? runReportHTML() : ''}</div>`;
}

function showFinale(kind) {
  const F = finaleFacts(kind); _fnFacts = F;
  if (typeof hideGoalBanner === 'function') hideGoalBanner();
  if (typeof boardScreenOpen !== 'function' || !bsStage()) { finaleFallback(F); return; }
  if (typeof keysReturn === 'function') keysReturn();
  if (typeof mapKeysReturn === 'function') mapKeysReturn();   // the Schedule's tools, if its screen was still up
  const again = () => { closeFinale(); if (F.drive) { try { sessionStorage.setItem('lethe.openBuilds.v1', '1'); } catch (e) {} location.reload(); } else startGame(); };
  const home = () => { closeFinale(); location.reload(); };
  const canEndless = F.won && !F.drive && typeof endlessOfferable === 'function' && endlessOfferable();
  const ctl = boardScreenOpen({
    head: `> ${F.title}${F.mode ? ' · ' + F.mode.toUpperCase() : ''}${F.drive && typeof testDrive !== 'undefined' && testDrive && testDrive.name ? ' · ' + testDrive.name.toUpperCase() : ''}`,
    html: finaleBodyHTML(F), cls: 'fn-screen' + (F.won ? ' fn-won' : ''), peek: true, zIndex: 10002,
    keys: [
      { label: 'SHARE', id: 'fn-share', fn: () => finaleShareView(F) },
      { label: 'SAVE BUILD', id: 'fn-save', fn: () => finaleSaveView(F) },
      { label: 'DETAILS', id: 'fn-details', fn: (c, b) => { const d = c.body.querySelector('.fn-details'); if (!d) return; d.hidden = !d.hidden; b.classList.toggle('bs-primary', !d.hidden); if (!d.hidden) d.scrollIntoView({ block: 'nearest' }); } },
    ],
  });
  if (!ctl) { finaleFallback(F); return; }
  _fnCtl = ctl;
  finaleFitStats(ctl);
  const _place = ctl.place; ctl.place = () => { _place(); finaleFitStats(ctl); };
  if (typeof keysTake === 'function') keysTake({
    play: { ico: '&#9654;', word: F.drive ? 'BACK TO BUILDS' : 'PLAY AGAIN', title: F.drive ? 'Back to Builds' : 'Start a new run', fn: again },
    disc: { ico: '&#8962;', word: 'HOME', title: 'The main menu', fn: home },
    swap: canEndless ? { ico: '&#8623;', word: 'ENDLESS', title: 'Keep going: Q5 and on, quotas climbing faster', fn: () => { closeFinale(); endlessContinue(); } } : { word: '', off: true },
  });
  if (F.won && typeof sfxVictory === 'function') sfxVictory();
}
// A stat's value shrinks to its box ("Three of a Kind" in a 90px box); words never break.
function finaleFitStats(ctl) {
  ctl.body.querySelectorAll('.fn-stat .fn-val, .fn-stat small').forEach(v => {
    v.style.fontSize = '';
    let px = parseFloat(getComputedStyle(v).fontSize) || 19;
    const box = v.parentElement.clientWidth - 8;
    while (px > 9 && v.scrollWidth > box) { px -= 1; v.style.fontSize = px + 'px'; }
  });
}
function closeFinale() {
  if (typeof keysReturn === 'function') keysReturn();
  if (_fnCtl) { const c = _fnCtl; _fnCtl = null; c.close(true); }
}
// A sub-view replaces the body until BACK; the keys row swaps with it.
function finaleSubView(html, keys) {
  const ctl = _fnCtl; if (!ctl) return null;
  if (!ctl._main) ctl._main = { html: ctl.body.innerHTML, keys: ctl.keys.innerHTML, nodes: [...ctl.keys.children] };
  ctl.body.innerHTML = html; ctl.body.scrollTop = 0;
  ctl.keys.innerHTML = '';
  const mk = k => { const b = document.createElement('button'); b.type = 'button'; b.className = 'bs-key' + (k.primary ? ' bs-primary' : ''); b.textContent = k.label; if (k.id) b.id = k.id; b.addEventListener('click', e => { e.stopPropagation(); k.fn && k.fn(ctl, b); }); ctl.keys.appendChild(b); return b; };
  keys.forEach(mk);
  mk({ label: 'BACK', fn: () => finaleMainView() });
  return ctl;
}
function finaleMainView() {
  const ctl = _fnCtl; if (!ctl || !ctl._main) return;
  ctl.body.innerHTML = ctl._main.html;
  finaleFitStats(ctl);
  ctl.keys.innerHTML = ''; ctl._main.nodes.forEach(n => ctl.keys.appendChild(n));
  const pk = ctl.keys.querySelector('.bs-peek-key'); if (pk) ctl.peek(false);
}
// SAVE BUILD: a name on the screen, then js/builds.js.
function finaleSaveView(F) {
  const def = (F.drive && typeof testDrive !== 'undefined' && testDrive && testDrive.name) || `${F.mode || 'Run'} ${F.date}`;
  const ctl = finaleSubView(`<div class="bs-note">Name this build.</div>
    <div class="fn-field"><span class="fn-prompt">&gt;</span><input id="fn-name" class="fn-input" type="text" maxlength="40" value="${def.replace(/"/g, '&quot;')}" spellcheck="false"></div>
    <div class="bs-sub">${F.owned.tricks.length} Tricks · ${F.owned.knacks.length} Knacks · ${F.owned.sleights.length} Sleights</div>
    <div class="fn-load-row fn-mini">${F.owned.tricks.map(t => finaleTile(t, 'trick')).join('')}${F.owned.knacks.map(k => finaleTile(k, 'knack')).join('')}${F.owned.sleights.map(s => finaleTile(s, 'sleight')).join('')}</div>`,
    [{ label: 'SAVE', primary: true, fn: (c) => {
      const inp = c.body.querySelector('#fn-name'); const name = (inp && inp.value.trim()) || def;
      const rec = saveBuildRecord({ name, tricks: F.owned.tricks.map(t => t.id), sleights: F.owned.sleights.map(s => s.id), knacks: F.owned.knacks.map(k => k.id) });
      if (typeof noteMessage === 'function') noteMessage(`Build saved: ${rec.name}`);
      finaleMainView();
      const k = c.keys.querySelector('#fn-save'); if (k) { k.textContent = `SAVED "${rec.name.toUpperCase()}"`; k.classList.add('bs-dim'); }
    } }]);
  if (!ctl) return;
  const inp = ctl.body.querySelector('#fn-name');
  if (inp) { inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') ctl.keys.querySelector('.bs-primary')?.click(); }); inp.focus(); inp.select(); }
}

// The pre-r634 end overlay, for a page with no stage to lay a screen on.
function finaleFallback(F) {
  const ov = document.getElementById('end-overlay'); if (!ov) return;
  const t = document.getElementById('end-title'); if (t) t.textContent = F.title;
  const s = document.getElementById('end-stats'); if (s) s.innerHTML = `<div>${F.mode} · ${F.far}</div><div>Score ${F.total.toLocaleString()}</div><div>Best hand ${F.bestHand || '·'} ${F.bestHandScore.toLocaleString()}</div><div>Hands ${F.hands} · ${finaleClock(F.secs)}</div>`;
  ov.classList.add('show');
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
