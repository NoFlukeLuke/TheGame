// ═══════════════════════════════════════════════════════════════════════════
// EVENT TOUR (r581) - every live event, one after another, with a verdict each
// ═══════════════════════════════════════════════════════════════════════════
// Owner: "make a preview that takes you through each event one by one and ill
// play through it and decide which to cut or edit." Open index.html?events (or
// dev panel -> Events & Bosses -> Event Tour). It starts a Classic run, gives it
// enough to make every event usable (credits, Tricks, a Knack, a Sleight, a
// liability), pauses the clock, and opens each event for real: the same
// renderer, the same handlers, the same board screens. KEEP / EDIT / CUT and a
// note are saved per event in this browser (lethe.eventTour.v1); COPY puts the
// whole list on the clipboard to paste back. Nothing here runs without ?events.
(function () {
  if (!/[?&]events\b/.test(location.search)) return;
  const KEY = 'lethe.eventTour.v1';
  let verdicts = {};
  try { verdicts = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(verdicts)); } catch (e) {} };
  let ids = [], at = 0, panel = null, ready = false;
  try { window.insightsOn = () => false; } catch (e) {}

  // Enough of a run that every event has something to work on.
  function stock() {
    coins = Math.max(coins, 200); updateCoinsUI?.();
    const owned = new Set(trickTray.map(t => t.id));
    const fill = TRICK_POOL.filter(t => !owned.has(t.id) && !(typeof survivalEntityBanned === 'function' && survivalEntityBanned(t.id)));
    // r590: enough improvable entities for Entity Slots (5) as well
    while ((trickTray.length < 4 || evImprovables().length < 6) && fill.length && !trickTrayFull()) injectTrickAfterReward(fill.shift());
    if (evImprovables().length < 6) KNACK_POOL.filter(k => !acquiredKnacks.some(a => a.id === k.id) && typeof canImprove === 'function' && canImprove(k.id)).slice(0, 6 - evImprovables().length).forEach(k => acquiredKnacks.push({ ...k }));
    if (!acquiredKnacks.length) { const k = KNACK_POOL.find(x => x.rarity === 'common'); if (k) { acquiredKnacks.push({ ...k }); updateKnackList?.(); } }
    if (!grantedSleightIds.size) { const s = SLEIGHT_POOL.find(x => sleightOfferable(x) && x.durability !== 'infinite'); if (s) grantSleight(s); }
    if (!Object.keys(cardCurses).length) curseRandomCard();
    if (goalPenaltyMult <= 1) goalPenaltyMult = 1.1;
    gameTimerPaused = true;
  }
  function settle() {
    gameTimerPaused = true;
    document.getElementById('next-goal-bg')?.classList.remove('show');
    try { recomputeGridMetrics(); } catch (e) {}
    try { _devSafeRender(); } catch (e) {}
  }
  // A board screen left open by the last event (a pick, the Call It grid) goes first.
  function closeTakeovers() {
    try { if (typeof gridPickState !== 'undefined' && gridPickState) closeGridPick(); } catch (e) {}
    try { if (typeof rewardOnGrid !== 'undefined' && rewardOnGrid) { _penaltyDone = null; closeRewardGrid(); } } catch (e) {}
  }
  function open() {
    const id = ids[at];
    if (!id) return;
    closeTakeovers(); settle(); stock();
    guidedOpenNamedEvent(id, () => { settle(); paint(); });
    paint();
  }
  function go(d) { at = (at + d + ids.length) % ids.length; open(); }

  function paint() {
    if (!panel) return;
    const id = ids[at], meta = EVENT_META[id] || { name: id };
    const v = verdicts[id] || {};
    const counts = ['keep', 'edit', 'cut'].map(k => `${Object.values(verdicts).filter(x => x.v === k).length} ${k}`).join(' · ');
    const live = !!activeEventId;
    panel.querySelector('.et-n').textContent = `${at + 1} / ${ids.length}`;
    panel.querySelector('.et-head b').textContent = panel.classList.contains('folded') ? meta.name : 'EVENT TOUR';
    panel.querySelector('.et-name').textContent = meta.name;
    panel.querySelector('.et-id').textContent = id + (eventEligible(id) ? '' : ' · would not be offered right now');
    panel.querySelectorAll('.et-v button').forEach(b => b.classList.toggle('on', b.dataset.v === v.v));
    const ta = panel.querySelector('textarea');
    if (document.activeElement !== ta) ta.value = v.note || '';
    panel.querySelector('.et-open').textContent = live ? 'OPEN AGAIN' : 'OPEN';
    panel.querySelector('.et-count').textContent = counts;
  }
  function verdict(v) {
    const id = ids[at];
    const cur = verdicts[id] || {};
    verdicts[id] = { ...cur, v: cur.v === v ? undefined : v };
    save(); paint();
  }
  function summary() {
    const order = ['cut', 'edit', 'keep', undefined];
    const label = { cut: 'CUT', edit: 'EDIT', keep: 'KEEP', undefined: 'NO VERDICT' };
    const lines = [`Event tour verdicts (${typeof BUILD !== 'undefined' ? BUILD : ''})`];
    order.forEach(k => {
      const list = ids.filter(id => (verdicts[id] || {}).v === k);
      if (!list.length) return;
      lines.push('', label[k]);
      list.forEach(id => { const n = (verdicts[id] || {}).note; lines.push(`- ${EVENT_META[id].name} (${id})${n ? ': ' + n.replace(/\s+/g, ' ').trim() : ''}`); });
    });
    return lines.join('\n');
  }
  function copy() {
    const text = summary();
    const done = () => { const b = panel.querySelector('.et-copy'); b.textContent = 'COPIED'; setTimeout(() => { b.textContent = 'COPY ALL'; }, 1400); };
    const box = () => {
      const t = panel.querySelector('.et-out'); t.style.display = 'block'; t.value = text; t.focus(); t.select();
      try { if (document.execCommand('copy')) done(); } catch (e) {}
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, box); else box();
  }

  function build() {
    panel = document.createElement('div');
    panel.id = 'event-tour';
    panel.innerHTML = `
      <div class="et-head"><button class="et-hp">‹</button><b>EVENT TOUR</b><span class="et-n"></span><button class="et-hn">›</button><button class="et-min" title="Fold">–</button></div>
      <div class="et-body">
        <div class="et-name"></div><div class="et-id"></div>
        <div class="et-row"><button class="et-prev">‹ PREV</button><button class="et-open">OPEN</button><button class="et-next">NEXT ›</button></div>
        <div class="et-row et-v"><button data-v="keep">KEEP</button><button data-v="edit">EDIT</button><button data-v="cut">CUT</button></div>
        <textarea placeholder="Notes: what to change, or why it goes"></textarea>
        <div class="et-row"><button class="et-copy">COPY ALL</button><span class="et-count"></span></div>
        <textarea class="et-out" readonly></textarea>
      </div>`;
    document.body.appendChild(panel);
    panel.querySelector('.et-prev').onclick = () => go(-1);
    panel.querySelector('.et-next').onclick = () => go(1);
    panel.querySelector('.et-open').onclick = () => open();
    panel.querySelectorAll('.et-v button').forEach(b => b.onclick = () => verdict(b.dataset.v));
    panel.querySelector('.et-copy').onclick = copy;
    panel.querySelector('.et-hp').onclick = () => go(-1);
    panel.querySelector('.et-hn').onclick = () => go(1);
    panel.querySelector('.et-min').onclick = () => { panel.classList.toggle('folded'); paint(); };
    // On a phone the panel sits over the top of the screen, folded to its bar.
    if (window.innerWidth < 700) panel.classList.add('folded');
    const ta = panel.querySelector('textarea');
    ta.addEventListener('input', () => { const id = ids[at]; verdicts[id] = { ...(verdicts[id] || {}), note: ta.value }; save(); });
    // Keys typed into the notes must not reach the game's shortcuts.
    panel.addEventListener('keydown', e => e.stopPropagation());
  }

  function start() {
    if (ready) return;
    ready = true;
    ids = liveEventIds();
    try { devStartMode('normal'); } catch (e) {}
    setTimeout(() => {
      try { tutorialEnd(); } catch (e) {}
      build();
      const first = ids.findIndex(id => !(verdicts[id] || {}).v);
      at = first >= 0 ? first : 0;
      open();
    }, 2500);
  }
  window.addEventListener('load', () => setTimeout(start, 1200));
})();
