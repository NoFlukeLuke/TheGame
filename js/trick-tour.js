// ═══════════════════════════════════════════════════════════════════════════
// TRICK TOUR (r620) - every Trick of a tier, one after another, on a live board
// ═══════════════════════════════════════════════════════════════════════════
// Owner: "a preview like the event tour but for all the common tricks, where it
// goes through them one by one. I want to do the balance pass where we scale
// everything up." Open index.html?tricks (common), ?tricks=rare, ?tricks=epic,
// ?tricks=legendary or ?tricks=all (dev panel -> Bonuses -> Trick Tour). It
// starts a Classic run, ends the walkthrough, puts the round's goal out of reach
// so the round never ends, and shows one Trick at a time: the tray holds only
// that Trick, the score is zeroed, and hands are played for real on the board.
//
// The panel shows the Trick's tile, its live description and EVERY number it has
// in BAL. Typing a new number writes BAL_BASE and reapplies the tiers, so the
// next hand scores with it and the description reads it (the only sanctioned
// BAL write, js/improve.js). Numbers, KEEP / EDIT / CUT and a note are saved per
// Trick in this browser (lethe.trickTour.v1); COPY ALL puts the whole list, old
// number -> new number included, on the clipboard to paste back. Nothing here
// runs without ?tricks.
(function () {
  const m = /[?&]tricks(?:=([a-z]+))?\b/.exec(location.search);
  if (!m) return;
  const TIER = m[1] || 'common';
  const KEY = 'lethe.trickTour.v1';
  let store = {};
  try { store = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} };
  const rec = id => (store[id] = store[id] || {});
  let list = [], at = 0, panel = null, ready = false, clockOn = false, watch = 0;
  try { window.insightsOn = () => false; } catch (e) {}

  // Tricks that only show with the clock running start with it running.
  const CLOCK_IDS = new Set(['early_bird', 'night_owl', 'quick_draw', 'ticktock', 'second_hand', 'first_wind',
    'patience_reward', 'still_water', 'swift', 'sediment', 'albatross', 'kingfisher', 'quarter_chime', 'minute_hand',
    'hourglass', 'woodpecker', 'closing_time', 'corner_retrigger', 'sands_of_time', 'spade_flood',
    'meditation', 'deep_breath', 'frozen_moment', 'cuckoo', 'phoenix', 'patient_rulers']);
  // What the board cannot show. Printed under the description.
  const OFF_BOARD = {
    more_better: `Pays on ${gridName('reward', { a: true })}. Not seen here.`,
    tunnel_vision: 'Pays at the start of a round. REFILL resets Focus; the next real round shows it.',
    first_wind: 'Holds Focus decay for the first 45s of a round. Run the clock from a REFILL.',
    five_fodder: 'Select a 5-card hand and press DISCARD.',
    rain_check: 'Pays when a reward is skipped. Not seen here.',
    wild_side: 'Counts negative reward tiles. Not seen here.',
    wait_for_it: 'Counts negative reward tiles. Not seen here.',
    sapling: 'Pays at each level-up. Not seen here.',
    first_fruits: 'Pays on the first hand of a round. REFILL does not count as a round start.',
    rising_tide: 'Grows at each level-up. Not seen here.',
    life_lessons: 'Grows at each round end. Not seen here.',
    magician: 'Two Sleights are in the deck for it.',
    cull: 'Swap or discard with stock left.',
    expanse: 'Reach the Focus cap.',
    release_valve: 'Reach the Focus cap.',
  };

  function pool() {
    const src = (typeof TRICK_POOL !== 'undefined' && TRICK_POOL.length) ? TRICK_POOL : TRICK_POOL_ALL;
    return src.filter(t => t && !t.retired && (TIER === 'all' || t.tier === TIER));
  }
  // Every number a Trick has, from the pristine table (BAL_BASE is what the
  // tiers are applied over; BAL is the applied result).
  function nums(id) {
    const b = (typeof BAL_BASE !== 'undefined' && BAL_BASE[id]) || null;
    if (!b) return [];
    return Object.keys(b).filter(k => typeof b[k] === 'number').map(k => ({ k, v: b[k] }));
  }
  // Shipped values, read once before any edit is applied, so COPY ALL can print old -> new.
  const shipped = {};
  function remember(id) { if (!shipped[id]) shipped[id] = Object.fromEntries(nums(id).map(n => [n.k, n.v])); }
  function applyNums(id) {
    const r = store[id]; if (!r || !r.nums) return;
    remember(id);
    const b = BAL_BASE[id]; if (!b) return;
    let changed = false;
    for (const k in r.nums) { const v = Number(r.nums[k]); if (k in b && isFinite(v) && b[k] !== v) { b[k] = v; changed = true; } }
    return changed;
  }
  function setNum(id, k, v) {
    remember(id);
    const r = rec(id); r.nums = r.nums || {};
    if (!isFinite(v) || v === shipped[id][k]) delete r.nums[k]; else r.nums[k] = v;
    if (!Object.keys(r.nums).length) delete r.nums;
    BAL_BASE[id][k] = isFinite(v) ? v : shipped[id][k];
    save();
    try { applyEntityTiers(); } catch (e) {}
    try { renderTrickTray(); } catch (e) {}
    paint(true);
  }

  // The tray holds only the Trick on show. Like sellTrick, without the credits.
  function clearTray() {
    try { hideTrickTooltip(); } catch (e) {}
    trickTray.length = 0;
    acquiredTricks.length = 0;
    try { renderTrickTray(); } catch (e) {}
  }
  // Enough of a run that every Trick has something to work on.
  function stock() {
    coins = Math.max(coins, 50); updateCoinsUI?.();
    if (grantedSleightIds.size < 2) {
      SLEIGHT_POOL.filter(x => !grantedSleightIds.has(x.id) && sleightOfferable(x) && x.durability !== 'infinite')
        .slice(0, 2 - grantedSleightIds.size).forEach(grantSleight);
    }
    roundGoal = 1e12;      // the round never ends on the goal
    try { updateScoreUI(); } catch (e) {}
  }
  // Clock back to the round's start, stock back to full, Focus and score to zero.
  function refill() {
    score = 0;
    try { resetFocusMeter(); } catch (e) {}
    try { const r = computeRoundResources(); if (r) { if (r.swaps != null) swaps = r.swaps; if (r.discards != null) discards = r.discards; } } catch (e) {}
    if (roundSeconds < roundStartSeconds) { try { rewindTime(roundStartSeconds - roundSeconds, 'tour'); } catch (e) {} }
    if (roundSeconds < roundStartSeconds) { roundSeconds = roundStartSeconds; }
    try { updateClockUI(); updateScoreUI(); updateSelectionUI(); } catch (e) {}
    try { _devSafeRender(); } catch (e) {}
  }
  function setClock(on) {
    clockOn = !!on;
    gameTimerPaused = !clockOn;
    paint();
  }
  // The clock running out would lose the run: top it up before it gets there.
  function tick() {
    if (!ready || !clockOn) return;
    if (roundSeconds <= 8) { try { rewindTime(roundStartSeconds, 'tour'); } catch (e) {} if (roundSeconds <= 8) roundSeconds = roundStartSeconds; try { updateClockUI(); } catch (e) {} }
    if (roundGoal < 1e12) { roundGoal = 1e12; try { updateScoreUI(); } catch (e) {} }
  }

  function open() {
    const t = list[at];
    if (!t) return;
    clearTray(); stock();
    score = 0;
    applyNums(t.id);
    try { applyEntityTiers(); } catch (e) {}
    injectTrickAfterReward(t);
    try { recomputeFocusDecayInterval(); } catch (e) {}
    try { updateScoreUI(); } catch (e) {}
    try { _devSafeRender(); } catch (e) {}
    setClock(CLOCK_IDS.has(t.id));
    paint(true);
  }
  function go(d) { at = (at + d + list.length) % list.length; open(); }

  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function paint(full) {
    if (!panel) return;
    const t = list[at]; if (!t) return;
    const r = store[t.id] || {};
    const counts = ['keep', 'edit', 'cut'].map(k => `${Object.values(store).filter(x => x.v === k).length} ${k}`).join(' · ');
    const edited = Object.values(store).filter(x => x.nums && Object.keys(x.nums).length).length;
    panel.querySelector('.tt-n').textContent = `${at + 1} / ${list.length}`;
    panel.querySelector('.tt-head b').textContent = panel.classList.contains('folded') ? t.name : `TRICK TOUR · ${TIER.toUpperCase()}`;
    if (full) {
      const live = (typeof trickLiveDesc === 'function') ? trickLiveDesc(t) : t.desc;
      panel.querySelector('.tt-tile').innerHTML = (typeof entityTileHTML === 'function')
        ? entityTileHTML({ entity: 'trick', id: t.id, emoji: trickEmoji(t), label: t.name }, t.tier, { tip: false }) : '';
      panel.querySelector('.tt-name').textContent = t.name;
      panel.querySelector('.tt-id').textContent = `${t.id} · ${t.tier}`;
      panel.querySelector('.tt-desc').textContent = live;
      const off = OFF_BOARD[t.id];
      const offEl = panel.querySelector('.tt-off'); offEl.textContent = off || ''; offEl.style.display = off ? '' : 'none';
      remember(t.id);
      const rows = nums(t.id);
      panel.querySelector('.tt-nums').innerHTML = rows.length
        ? rows.map(n => { const was = shipped[t.id][n.k]; const ch = n.v !== was;
            return `<label class="tt-num${ch ? ' tt-changed' : ''}"><span>${esc(n.k)}</span><input type="number" step="any" data-k="${esc(n.k)}" value="${n.v}"><i>${ch ? 'was ' + was : ''}</i></label>`; }).join('')
        : '<div class="tt-nonum">No number in BAL. Its value is in the code.</div>';
      panel.querySelectorAll('.tt-num input').forEach(inp => {
        inp.addEventListener('change', () => setNum(t.id, inp.dataset.k, Number(inp.value)));
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); });
      });
      const ta = panel.querySelector('.tt-note');
      if (document.activeElement !== ta) ta.value = r.note || '';
    }
    panel.querySelectorAll('.tt-v button').forEach(b => b.classList.toggle('on', b.dataset.v === r.v));
    panel.querySelector('.tt-clock').textContent = clockOn ? 'CLOCK: RUNNING' : 'CLOCK: HELD';
    panel.querySelector('.tt-clock').classList.toggle('on', clockOn);
    panel.querySelector('.tt-count').textContent = `${counts} · ${edited} renumbered`;
  }
  function verdict(v) {
    const t = list[at], r = rec(t.id);
    r.v = r.v === v ? undefined : v;
    save(); paint();
  }
  function summary() {
    const order = ['cut', 'edit', 'keep', undefined];
    const label = { cut: 'CUT', edit: 'EDIT', keep: 'KEEP', undefined: 'NO VERDICT' };
    const lines = [`Trick tour (${TIER}) verdicts (${typeof BUILD !== 'undefined' ? BUILD : ''})`];
    const numLine = id => { const r = store[id]; if (!r || !r.nums) return ''; remember(id);
      return Object.keys(r.nums).map(k => `${k} ${shipped[id][k]} -> ${r.nums[k]}`).join(', '); };
    order.forEach(k => {
      const sub = list.filter(t => (store[t.id] || {}).v === k);
      if (!sub.length) return;
      lines.push('', label[k]);
      sub.forEach(t => {
        const r = store[t.id] || {}; const n = numLine(t.id);
        lines.push(`- ${t.name} (${t.id})${n ? ' [' + n + ']' : ''}${r.note ? ': ' + r.note.replace(/\s+/g, ' ').trim() : ''}`);
      });
    });
    return lines.join('\n');
  }
  function copy() {
    const text = summary();
    const done = () => { const b = panel.querySelector('.tt-copy'); b.textContent = 'COPIED'; setTimeout(() => { b.textContent = 'COPY ALL'; }, 1400); };
    const box = () => {
      const o = panel.querySelector('.tt-out'); o.style.display = 'block'; o.value = text; o.focus(); o.select();
      try { if (document.execCommand('copy')) done(); } catch (e) {}
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, box); else box();
  }

  function build() {
    panel = document.createElement('div');
    panel.id = 'trick-tour';
    panel.innerHTML = `
      <div class="tt-head"><button class="tt-hp">‹</button><b>TRICK TOUR</b><span class="tt-n"></span><button class="tt-hn">›</button><button class="tt-min" title="Fold">–</button></div>
      <div class="tt-body">
        <div class="tt-top"><div class="tt-tile"></div><div><div class="tt-name"></div><div class="tt-id"></div></div></div>
        <div class="tt-desc"></div>
        <div class="tt-off"></div>
        <div class="tt-nums"></div>
        <div class="tt-row"><button class="tt-prev">‹ PREV</button><button class="tt-open">AGAIN</button><button class="tt-next">NEXT ›</button></div>
        <div class="tt-row"><button class="tt-clock">CLOCK: HELD</button><button class="tt-refill">REFILL</button></div>
        <div class="tt-row tt-v"><button data-v="keep">KEEP</button><button data-v="edit">EDIT</button><button data-v="cut">CUT</button></div>
        <textarea class="tt-note" placeholder="Notes: what to change, or why it goes"></textarea>
        <div class="tt-row"><button class="tt-copy">COPY ALL</button><span class="tt-count"></span></div>
        <textarea class="tt-out" readonly></textarea>
      </div>`;
    document.body.appendChild(panel);
    panel.querySelector('.tt-prev').onclick = () => go(-1);
    panel.querySelector('.tt-next').onclick = () => go(1);
    panel.querySelector('.tt-open').onclick = () => open();
    panel.querySelector('.tt-clock').onclick = () => setClock(!clockOn);
    panel.querySelector('.tt-refill').onclick = refill;
    panel.querySelectorAll('.tt-v button').forEach(b => b.onclick = () => verdict(b.dataset.v));
    panel.querySelector('.tt-copy').onclick = copy;
    panel.querySelector('.tt-hp').onclick = () => go(-1);
    panel.querySelector('.tt-hn').onclick = () => go(1);
    panel.querySelector('.tt-min').onclick = () => { panel.classList.toggle('folded'); paint(); };
    if (window.innerWidth < 700) panel.classList.add('folded');
    const ta = panel.querySelector('.tt-note');
    ta.addEventListener('input', () => { rec(list[at].id).note = ta.value; save(); });
    // Keys typed into the panel must not reach the game's shortcuts.
    panel.addEventListener('keydown', e => e.stopPropagation());
  }

  function start() {
    if (ready) return;
    ready = true;
    try { devStartMode('normal'); } catch (e) {}
    setTimeout(() => {
      try { tutorialEnd(); } catch (e) {}
      list = pool();
      // Every saved number is live for the whole tour, not only the Trick on show.
      let any = false; list.forEach(t => { if (applyNums(t.id)) any = true; });
      if (any) { try { applyEntityTiers(); } catch (e) {} }
      build();
      const first = list.findIndex(t => !(store[t.id] || {}).v);
      at = first >= 0 ? first : 0;
      open();
      watch = setInterval(tick, 500);
    }, 2500);
  }
  window.addEventListener('load', () => setTimeout(start, 1200));
})();
