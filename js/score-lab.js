// ═══════════════════════════════════════════════════════════════════════════
// SCORING PREVIEW (r772) - index.html?lab
// ═══════════════════════════════════════════════════════════════════════════
// Owner: "a scoring preview that allows me to search for tricks and knacks etc,
// then play hands, then converts the scoring into a readable list of what
// happens at each step."
//
// A Classic run with the walkthrough ended, the goal out of reach and the clock
// held. The panel on the left has a search over every Trick, Knack and Sleight
// (name, id or words of the description); + adds one for real (the game's own
// grant paths). Each Trick in the build can be moved, primed, permaprimed, armed
// for a forced fire, improved and removed. Hands are played on the real board
// through the real playHand.
//
// THE LIST IS THE GAME'S OWN TIMELINE. Every played hand's banked ledger (the one
// the score dance replays) is walked with the dance's arithmetic and printed one
// line per event: who, what, and the running PIPS and MULT after it. If the walk
// does not land on the ledger's final pips and mult the entry says so. Under it:
// what happened to primes and forced fires because of that hand.
//
// Nothing here runs without ?lab, and nothing is stored.
(function () {
  if (!/[?&]lab\b/.test(location.search)) return;
  const PANEL_W = 400, WIDE_MIN = 1100;
  let panel = null, ready = false, clockOn = false, entries = [], handNo = 0, cap = null, filter = 'all';
  try { window.insightsOn = () => false; } catch (e) {}

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmtM = m => (Math.round(m * 10) / 10 % 1 === 0) ? String(Math.round(m * 10) / 10) : (Math.round(m * 10) / 10).toFixed(1);
  const fmtN = n => Math.round(n).toLocaleString('en-US');
  const SUIT = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠', crowns: '♛', crescents: '☾' };
  const cardName = c => c ? (c.rank === (typeof WILD_RANK !== 'undefined' ? WILD_RANK : '?') ? 'Wild' : c.rank + (SUIT[c.suit] || c.suit || '')) : '?';

  // ── Catalogue ──────────────────────────────────────────────────────────────
  function catalogue() {
    const out = [];
    (typeof TRICK_POOL_ALL !== 'undefined' ? TRICK_POOL_ALL : []).forEach(t => { if (t && !t.retired) out.push({ type: 'trick', id: t.id, name: t.name, rar: t.tier, desc: t.desc || '', fused: !!t.fused, row: t }); });
    (typeof KNACK_POOL !== 'undefined' ? KNACK_POOL : []).forEach(k => { if (k && !k.retired && !k.roleOnly) out.push({ type: 'knack', id: k.id, name: k.name, rar: k.rarity || k.tier, desc: k.desc || '', row: k }); });
    (typeof SLEIGHT_POOL !== 'undefined' ? SLEIGHT_POOL : []).forEach(s => { if (s && !s.retired) out.push({ type: 'sleight', id: s.id, name: s.name, rar: s.rarity, desc: s.desc || '', row: s }); });
    return out;
  }
  function search(q) {
    q = q.trim().toLowerCase();
    let list = catalogue().filter(e => filter === 'all' || e.type === filter);
    if (!q) return list.filter(e => !e.fused).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 40);
    const words = q.split(/\s+/);
    const score = e => {
      const n = e.name.toLowerCase(), d = e.desc.toLowerCase();
      if (n === q || e.id === q) return 0;
      if (n.startsWith(q)) return 1;
      if (n.includes(q) || e.id.includes(q)) return 2;
      if (words.every(w => n.includes(w) || d.includes(w))) return 3;
      return -1;
    };
    return list.map(e => ({ e, s: score(e) })).filter(x => x.s >= 0).sort((a, b) => a.s - b.s || a.e.name.localeCompare(b.e.name)).slice(0, 40).map(x => x.e);
  }
  const nameOf = id => {
    const hit = catalogue().find(e => e.id === id) || (typeof TRICK_POOL_ALL !== 'undefined' && TRICK_POOL_ALL.find(t => t.id === id));
    return hit ? hit.name : null;
  };

  // ── Granting and removing (the game's own paths) ───────────────────────────
  function add(e) {
    try {
      if (e.type === 'trick') {
        if (trickTray.some(t => t.id === e.id)) return note(e.name + ' is already in the tray');
        limits.trick_slots.max = Math.max(limits.trick_slots.max, 10);
        limits.trick_slots.current = Math.max(limits.trick_slots.current, Math.min(10, trickTray.length + 1));
        injectTrickAfterReward({ ...e.row });
        recomputeFocusDecayInterval?.();
      } else if (e.type === 'knack') {
        if (hasKnack(e.id)) return note(e.name + ' is already owned');
        acquiredKnacks.push({ ...e.row });
        updateKnackList?.();
      } else {
        grantSleight(e.row);
        const c = drawPile.pop(); if (c) drawPile.unshift(c);     // top of the draw pile: it comes with the next cards dealt
        note(e.name + ' is on top of the deck: it arrives with the next cards dealt');
      }
    } catch (err) { console.error('[lab] add failed', err); note('Could not add ' + e.name); }
    paintBuild();
  }
  function removeTrick(id) {
    try { hideTrickTooltip?.(); } catch (e) {}
    let i = trickTray.findIndex(t => t.id === id); if (i >= 0) trickTray.splice(i, 1);
    i = acquiredTricks.findIndex(t => t.id === id); if (i >= 0) acquiredTricks.splice(i, 1);
    try { renderTrickTray(); _devSafeRender(); } catch (e) {}
    paintBuild();
  }
  function removeKnack(id) {
    const i = acquiredKnacks.findIndex(k => k.id === id); if (i >= 0) acquiredKnacks.splice(i, 1);
    try { updateKnackList(); } catch (e) {}
    paintBuild();
  }
  function moveTrick(id, d) {
    const i = trickTray.findIndex(t => t.id === id), j = i + d;
    if (i < 0 || j < 0 || j >= trickTray.length) return;
    const t = trickTray[i]; trickTray[i] = trickTray[j]; trickTray[j] = t;
    try { renderTrickTray(); } catch (e) {}
    paintBuild();
  }
  const armedCount = id => (typeof forcedTrickIds !== 'undefined' ? forcedTrickIds : []).filter(x => x === id).length;
  function trickAct(id, act) {
    const t = trickTray.find(x => x.id === id); if (!t) return;
    if (act === 'p+') t._primed = (t._primed || 0) + 1;                 // straight onto the Trick: no quarter limit, no Buddy System
    else if (act === 'p-') { t._primed = Math.max(0, (t._primed || 0) - 1); if (!t._primed) t._primeSrc = []; }
    else if (act === 'r+') t._rank = (t._rank || 0) + 1;
    else if (act === 'r-') t._rank = Math.max(0, (t._rank || 0) - 1);
    else if (act === 'f+') { if (trickCanForce(id)) armForcedTrick(id); else note(t.name + ' has no number a forced fire can pay'); }
    else if (act === 'f-') { const i = forcedTrickIds.indexOf(id); if (i >= 0) forcedTrickIds.splice(i, 1); }
    else if (act === 'v+') { try { improveEntity(id); } catch (e) {} }
    else if (act === 'l') return moveTrick(id, -1);
    else if (act === 'r') return moveTrick(id, 1);
    else if (act === 'x') return removeTrick(id);
    try { renderTrickTray(); } catch (e) {}
    paintBuild();
  }

  // ── The run ────────────────────────────────────────────────────────────────
  function hold() {
    roundGoal = 1e12;
    if (clockOn && roundSeconds <= 8) { try { rewindTime(roundStartSeconds, 'lab'); } catch (e) {} if (roundSeconds <= 8) roundSeconds = roundStartSeconds; try { updateClockUI(); } catch (e) {} }
  }
  function refill() {
    score = 0;
    try { resetFocusMeter(); } catch (e) {}
    try { const r = computeRoundResources(); if (r) { if (r.swaps != null) swaps = r.swaps; if (r.discards != null) discards = r.discards; } } catch (e) {}
    if (roundSeconds < roundStartSeconds) roundSeconds = roundStartSeconds;
    try { updateClockUI(); updateScoreUI(); updateSelectionUI(); _devSafeRender(); } catch (e) {}
  }
  function setClock(on) { clockOn = !!on; gameTimerPaused = !clockOn; paintBuild(); }
  // Three cards of one rank into the top row, for a hand you need now.
  function rig(rank) {
    let n = 0;
    for (let c = 0; c < gridCols && n < 3; c++) {
      const cd = gridData[0] && gridData[0][c];
      if (!cd || cd._isSleight || cd._isStone || cd.rank === WILD_RANK) continue;
      cd.rank = rank; n++;
    }
    try { _devSafeRender(); } catch (e) {}
    note(n + ' cards in the top row are now ' + rank);
  }
  function note(text) {
    const el = panel && panel.querySelector('.sl-note'); if (!el) return;
    el.textContent = text; clearTimeout(note._t); note._t = setTimeout(() => { el.textContent = ''; }, 4200);
  }

  // ── Reading a hand ─────────────────────────────────────────────────────────
  const PSEUDO = { _card: null, _ladder: 'Card ladder', _nsPips: 'Hand family growth', primed: 'Primed fire', overdrive: 'Overdrive' };
  function who(ev, card) {
    if (ev.id === '_card') return cardName(card) + ' (its own pips)';
    if (ev.id in PSEUDO) return PSEUDO[ev.id];
    if (ev.id === 'sapling' && !hasTrick('sapling')) return 'Card buff';
    return nameOf(ev.id) || ev.id;
  }
  const rnd = (v, how) => how === 'int' ? Math.round(v) : how === 'dp1' ? Math.round(v * 10) / 10 : v;
  const what = (ev, v) => ev.op === 'pip+' ? '+' + fmtN(v) + ' pips' : ev.op === 'mult+' ? '+' + fmtM(v) + ' mult'
    : ev.op === 'pip*' ? '×' + (Math.round(v * 100) / 100) + ' pips' : '×' + (Math.round(v * 100) / 100) + ' mult';
  const tagOf = ev => ev.forced ? 'forced' : ev.prime ? 'prime' : ev.id === 'mirror' ? 'mirror' : ev.id === 'move_as_one' ? 'again' : '';

  // The dance's own walk (js/score-dance.js), with a line written per event.
  function trace(L) {
    const tl = L.timeline || [], cards = L.cards || [], rows = [];
    let rp = L.basePips || 0, rm = L.baseMult || 0, n = 0;
    rows.push({ k: 'base', text: `The hand starts at ${fmtN(rp)} pips × ${fmtM(rm)} mult` });
    for (let i = 0; i < tl.length;) {
      const ev = tl[i];
      if (ev.card >= 0) {
        const ci = ev.card, start = i;
        while (i < tl.length && tl[i].card === ci) i++;
        const evs = tl.slice(start, i), cd = cards[ci] || {}, reps = cd.reps || 1;
        for (let rep = 0; rep < reps; rep++) {
          rows.push({ k: 'card', text: `${cardName(cd.card || cd)} ${rep ? 'scores again (replay ' + rep + ' of ' + (reps - 1) + ')' : 'scores'}` });
          let sub = 0;
          (rep === 0 ? evs.filter(e => !e.replay) : evs.filter(e => !e.once)).forEach(e0 => {
            const v = e0.vals ? e0.vals[rep] : e0.value;
            let extra = '';
            if (e0.op === 'pip+') sub += v;
            else if (e0.op === 'pip*' && e0.scope === 'total') { rp = rnd((rp + sub) * v, e0.rnd); sub = 0; extra = 'the whole pip total'; }
            else if (e0.op === 'pip*') { const was = sub; sub = rnd(sub * v, e0.rnd); extra = `this card's pips ${fmtN(was)} to ${fmtN(sub)}`; }
            else if (e0.op === 'mult+') rm += v;
            else rm = rnd(rm * v, e0.rnd);
            rows.push({ k: 'ev', n: ++n, who: who(e0, cd.card || cd), what: what(e0, v), extra, tag: tagOf(e0), p: rp + sub, m: rm, chip: e0.op[0] });
          });
          rp += sub;
        }
      } else {
        i++;
        if (ev.op === 'pip+') rp += ev.value;
        else if (ev.op === 'pip*') rp = rnd(rp * ev.value, ev.rnd);
        else if (ev.op === 'mult+') rm += ev.value;
        else rm = rnd(rm * ev.value, ev.rnd);
        rows.push({ k: 'ev', hand: true, n: ++n, who: who(ev, null), what: what(ev, ev.value), tag: tagOf(ev), p: rp, m: rm, chip: ev.op[0] });
      }
    }
    const drift = Math.abs(rp - L.finalPips) > 0.5 || Math.abs(rm - L.finalMult) > 0.05;
    return { rows, pips: L.finalPips, mult: L.finalMult, drift, walked: [rp, rm] };
  }

  const snap = () => ({
    tricks: trickTray.map(t => ({ id: t.id, name: t.name, primed: t._primed || 0, rank: t._rank || 0 })),
    armed: (typeof forcedTrickIds !== 'undefined' ? forcedTrickIds.slice() : []),
    score, focus: (typeof focusMultiplier === 'function' ? focusMultiplier() : 1),
  });
  // What the hand did to primes and forced fires, in words.
  function aftermath(before, after, result, tr) {
    const out = [], tl = (result._bankLedger.timeline || []);
    const paid = new Set((result._bankContrib || []).map(e => e.id));
    before.tricks.forEach(b => {
      const a = after.tricks.find(x => x.id === b.id); if (!a) return;
      const primeEvs = tl.filter(e => e.prime && e.id === b.id).length;
      const scored = tl.some(e => e.id === b.id && !e.prime && !e.forced);
      const forced = tl.some(e => e.id === b.id && e.forced);
      const fired = paid.has(b.id) || (typeof trickFiredThisHand === 'function' && trickFiredThisHand(b.id));
      const stacks = b.primed + b.rank;
      if (b.primed > 0 && fired) {
        if (primeEvs) out.push({ c: 'spend', t: `${b.name} used its ${b.primed} prime${b.primed > 1 ? 's' : ''}: its payout this hand was paid ${stacks} more time${stacks > 1 ? 's' : ''}${b.rank ? ' (' + b.rank + ' of them from its permanent prime)' : ''}.` });
        else if (forced && !scored) out.push({ c: 'warn', t: `${b.name} lost its ${b.primed} prime${b.primed > 1 ? 's' : ''} and they paid nothing: it only went off because it was forced, and a prime repeats a natural payout only.` });
        else out.push({ c: 'spend', t: `${b.name} used its ${b.primed} prime${b.primed > 1 ? 's' : ''} on a payout that is not pips or mult (Focus, seconds, credits or stock).` });
      } else if (b.primed > 0) out.push({ c: 'keep', t: `${b.name} did not go off, so it keeps its ${b.primed} prime${b.primed > 1 ? 's' : ''}.` });
      else if (b.rank > 0 && primeEvs) out.push({ c: 'spend', t: `${b.name} fired ${b.rank} more time${b.rank > 1 ? 's' : ''} from its permanent prime (never used up).` });
      const gained = a.primed - (b.primed > 0 && fired ? 0 : b.primed);
      if (gained > 0) out.push({ c: 'gain', t: `${b.name} was primed${gained > 1 ? ' ' + gained + ' times' : ''} by this hand. The prime waits for the next hand ${b.name} goes off in.` });
    });
    if (before.armed.length) {
      const names = before.armed.map(id => nameOf(id) || id).join(', ');
      out.push({ c: 'spend', t: `Armed forced fire${before.armed.length > 1 ? 's' : ''} used: ${names}.` });
    }
    return out;
  }

  function record(before, after, result) {
    const L = result._bankLedger; if (!L || !L.timeline) return;
    const tr = trace(L);
    const got = after.score - before.score;
    const raw = tr.pips * tr.mult;
    const cells = (L.cards || []).map(c => cardName(c.card || c)).join(' ');
    entries.unshift({
      no: ++handNo, name: (result.hand || 'Hand'), cells, tr, got, raw,
      focus: raw > 0 ? got / raw : 1, fNow: after.focus,
      after: aftermath(before, after, result, tr),
    });
    if (entries.length > 30) entries.length = 30;
    paintLog();
    paintBuild();
  }

  function entryText(e) {
    const lines = [`HAND ${e.no} · ${e.name} · ${e.cells}`];
    e.tr.rows.forEach(r => {
      if (r.k === 'base') lines.push('  ' + r.text);
      else if (r.k === 'card') lines.push('  ' + r.text + ':');
      else lines.push(`  ${String(r.n).padStart(2)}. ${r.hand ? '' : '   '}${r.who}${r.tag ? ' [' + r.tag.toUpperCase() + ']' : ''}: ${r.what}${r.extra ? ' (' + r.extra + ')' : ''}  ->  ${fmtN(r.p)} pips x ${fmtM(r.m)} mult`);
    });
    lines.push(`  = ${fmtN(e.tr.pips)} pips x ${fmtM(e.tr.mult)} mult = ${fmtN(e.raw)}` + (Math.abs(e.focus - 1) > 0.005 ? `, x${e.focus.toFixed(2)} Focus` : '') + ` = ${fmtN(e.got)}`);
    if (e.tr.drift) lines.push(`  WARNING: the list walked to ${fmtN(e.tr.walked[0])} x ${fmtM(e.tr.walked[1])}, the game scored ${fmtN(e.tr.pips)} x ${fmtM(e.tr.mult)}`);
    e.after.forEach(a => lines.push('  * ' + a.t));
    return lines.join('\n');
  }

  // ── Painting ───────────────────────────────────────────────────────────────
  const TAG_WORD = { prime: 'PRIMED', forced: 'FORCED', mirror: 'MIRROR', again: 'AGAIN' };
  function paintLog() {
    const host = panel.querySelector('.sl-log'); if (!host) return;
    if (!entries.length) { host.innerHTML = '<div class="sl-empty">Play a hand. Every step of its score prints here.</div>'; return; }
    host.innerHTML = entries.map((e, i) => `
      <details class="sl-hand"${i === 0 ? ' open' : ''}>
        <summary><b>HAND ${e.no}</b> ${esc(e.name)} <span class="sl-cells">${esc(e.cells)}</span><i>${fmtN(e.got)}</i></summary>
        <div class="sl-steps">
          ${e.tr.rows.map(r => r.k === 'base' ? `<div class="sl-base">${esc(r.text)}</div>`
            : r.k === 'card' ? `<div class="sl-card">${esc(r.text)}</div>`
            : `<div class="sl-ev${r.hand ? ' sl-h' : ''}${r.tag ? ' sl-t-' + r.tag : ''}"><span class="sl-n">${r.n}</span><span class="sl-who">${esc(r.who)}${r.tag ? ` <em>${TAG_WORD[r.tag]}</em>` : ''}${r.extra ? `<small>${esc(r.extra)}</small>` : ''}</span><span class="sl-what sl-${r.chip}">${esc(r.what)}</span><span class="sl-run"><b class="sl-p">${fmtN(r.p)}</b> × <b class="sl-m">${fmtM(r.m)}</b></span></div>`).join('')}
          <div class="sl-total"><b class="sl-p">${fmtN(e.tr.pips)}</b> pips × <b class="sl-m">${fmtM(e.tr.mult)}</b> mult = ${fmtN(e.raw)}${Math.abs(e.focus - 1) > 0.005 ? ` <span class="sl-f">× ${e.focus.toFixed(2)} Focus</span>` : ''} = <b>${fmtN(e.got)}</b></div>
          ${e.tr.drift ? `<div class="sl-warn">The list walked to ${fmtN(e.tr.walked[0])} × ${fmtM(e.tr.walked[1])}; the game scored ${fmtN(e.tr.pips)} × ${fmtM(e.tr.mult)}.</div>` : ''}
          ${e.after.map(a => `<div class="sl-after sl-a-${a.c}">${esc(a.t)}</div>`).join('')}
        </div>
      </details>`).join('');
  }
  function paintBuild() {
    if (!panel) return;
    const host = panel.querySelector('.sl-build');
    const tr = trickTray.map((t, i) => `
      <div class="sl-own" data-id="${esc(t.id)}">
        <span class="sl-slot">${i + 1}</span><span class="sl-oname" title="${esc(typeof trickLiveDesc === 'function' ? trickLiveDesc(t) : t.desc)}">${esc(t.name)}${(typeof entityTier !== 'undefined' && entityTier[t.id]) ? ' <small>v' + (entityTier[t.id] + 1) + '</small>' : ''}</span>
        <span class="sl-ctl" title="Primes: fire again on its next firing, then gone"><button data-a="p-">−</button><b class="sl-c-p">P ${t._primed || 0}</b><button data-a="p+">+</button></span>
        <span class="sl-ctl" title="Permanent primes: fire again every time, never used up"><button data-a="r-">−</button><b class="sl-c-r">PP ${t._rank || 0}</b><button data-a="r+">+</button></span>
        <span class="sl-ctl" title="Forced fires armed for the next hand"><button data-a="f-">−</button><b class="sl-c-f">F ${armedCount(t.id)}</b><button data-a="f+">+</button></span>
        <span class="sl-ctl sl-mv"><button data-a="l" title="Move left in the tray">‹</button><button data-a="r" title="Move right in the tray">›</button><button data-a="v+" title="Improve one step">v+</button><button data-a="x" title="Remove">×</button></span>
      </div>`).join('');
    const kn = acquiredKnacks.map(k => `<span class="sl-kn" data-kid="${esc(k.id)}" title="${esc(k.desc || '')}">${esc(k.name)} <button>×</button></span>`).join('');
    host.innerHTML = (tr || '<div class="sl-empty">No Tricks yet. Search above and press +.</div>') + (kn ? `<div class="sl-kns">${kn}</div>` : '');
    panel.querySelector('.sl-clock').textContent = clockOn ? 'CLOCK: RUNNING' : 'CLOCK: HELD';
    panel.querySelector('.sl-qrl').textContent = (typeof qrlEnabled !== 'undefined' && qrlEnabled) ? 'QUARTER LIMITS: ON' : 'QUARTER LIMITS: OFF';
  }
  function paintResults() {
    const q = panel.querySelector('.sl-q').value;
    const host = panel.querySelector('.sl-results');
    const list = search(q);
    host.innerHTML = list.length ? list.map(e => `
      <div class="sl-res" data-type="${e.type}" data-id="${esc(e.id)}">
        <button class="sl-add">+</button>
        <span class="sl-rt sl-rt-${e.type}">${e.type === 'trick' ? (e.fused ? 'PAIR' : 'TRICK') : e.type.toUpperCase()}</span>
        <span class="sl-rn"><b>${esc(e.name)}</b> <i class="sl-rar sl-rar-${esc(e.rar || '')}">${esc(e.rar || '')}</i><small>${esc(e.type === 'trick' && typeof trickLiveDesc === 'function' ? (trickLiveDesc(e.row) || e.desc) : e.desc)}</small></span>
      </div>`).join('') : '<div class="sl-empty">Nothing matches.</div>';
  }

  function build() {
    panel = document.createElement('div');
    panel.id = 'score-lab';
    panel.innerHTML = `
      <div class="sl-head"><b>SCORING PREVIEW</b><span class="sl-note"></span><button class="sl-fold" title="Fold">–</button></div>
      <div class="sl-body">
        <div class="sl-find">
          <input class="sl-q" type="search" placeholder="Search Tricks, Knacks, Sleights" autocomplete="off">
          <div class="sl-filter"><button data-f="all" class="on">ALL</button><button data-f="trick">TRICKS</button><button data-f="knack">KNACKS</button><button data-f="sleight">SLEIGHTS</button></div>
          <div class="sl-results"></div>
        </div>
        <div class="sl-sec">BUILD <small>P primes · PP permanent primes · F forced fires armed</small></div>
        <div class="sl-build"></div>
        <div class="sl-tools">
          <button class="sl-clock">CLOCK: HELD</button><button class="sl-refill">REFILL</button><button class="sl-qrl">QUARTER LIMITS: OFF</button>
          <span class="sl-rig">Deal 3 of <select class="sl-rank"></select><button class="sl-rigb">GO</button></span>
        </div>
        <div class="sl-sec">HANDS <button class="sl-copy">COPY</button><button class="sl-clear">CLEAR</button></div>
        <div class="sl-log"></div>
        <textarea class="sl-out" readonly></textarea>
      </div>`;
    document.body.appendChild(panel);
    const $ = s => panel.querySelector(s);
    $('.sl-rank').innerHTML = (typeof ACTIVE_RANKS !== 'undefined' ? ACTIVE_RANKS : ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2']).map(r => `<option>${esc(r)}</option>`).join('');
    $('.sl-q').addEventListener('input', paintResults);
    $('.sl-filter').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; filter = b.dataset.f; panel.querySelectorAll('.sl-filter button').forEach(x => x.classList.toggle('on', x === b)); paintResults(); });
    $('.sl-results').addEventListener('click', e => {
      const row = e.target.closest('.sl-res'); if (!row || !e.target.closest('.sl-add')) return;
      const hit = catalogue().find(x => x.type === row.dataset.type && x.id === row.dataset.id); if (hit) add(hit);
    });
    $('.sl-build').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const kn = b.closest('.sl-kn'); if (kn) return removeKnack(kn.dataset.kid);
      const own = b.closest('.sl-own'); if (own) trickAct(own.dataset.id, b.dataset.a);
    });
    $('.sl-clock').onclick = () => setClock(!clockOn);
    $('.sl-refill').onclick = refill;
    $('.sl-qrl').onclick = () => { qrlEnabled = !qrlEnabled; paintBuild(); };     // in memory only: the stored setting is not touched
    $('.sl-rigb').onclick = () => rig($('.sl-rank').value);
    $('.sl-clear').onclick = () => { entries = []; handNo = 0; paintLog(); };
    $('.sl-copy').onclick = () => {
      const text = entries.slice().reverse().map(entryText).join('\n\n');
      const done = () => { $('.sl-copy').textContent = 'COPIED'; setTimeout(() => { $('.sl-copy').textContent = 'COPY'; }, 1400); };
      const box = () => { const o = $('.sl-out'); o.style.display = 'block'; o.value = text; o.focus(); o.select(); try { if (document.execCommand('copy')) done(); } catch (e) {} };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, box); else box();
    };
    $('.sl-fold').onclick = () => { panel.classList.toggle('folded'); room(); };
    panel.addEventListener('keydown', e => e.stopPropagation());       // typing must not reach the game's shortcuts
    panel.addEventListener('keyup', e => e.stopPropagation());
    paintResults(); paintBuild(); paintLog();
  }
  // On a wide window the game is fitted beside the panel; on a narrow one the panel folds.
  function room() {
    const wide = window.innerWidth >= WIDE_MIN && !panel.classList.contains('folded');
    document.body.classList.toggle('sl-side', wide);
    const want = wide ? PANEL_W : 0;
    if (typeof camReserveLeft !== 'undefined' && camReserveLeft !== want) { camReserveLeft = want; window.dispatchEvent(new Event('resize')); }
  }

  // ── Hooks: the hand as the game banked it ──────────────────────────────────
  function hook() {
    const origQueue = window.dncPlayOrQueue, origPlay = window.playHand;
    if (typeof origQueue === 'function') window.dncPlayOrQueue = function (result) { cap = result; return origQueue.apply(this, arguments); };
    if (typeof origPlay === 'function') window.playHand = function () {
      const before = snap(); cap = null;
      const r = origPlay.apply(this, arguments);
      if (cap && cap._bankLedger) { try { record(before, snap(), cap); } catch (e) { console.error('[lab] record failed', e); } }
      cap = null;
      return r;
    };
  }

  window.scoreLabText = () => entries.slice().reverse().map(entryText).join('\n\n');   // the COPY text, for a console
  function start() {
    if (ready) return;
    ready = true;
    try { devStartMode('normal'); } catch (e) {}
    setTimeout(() => {
      try { tutorialEnd(); } catch (e) {}
      try { qrlEnabled = false; } catch (e) {}
      coins = Math.max(coins, 50); try { updateCoinsUI(); } catch (e) {}
      hook(); build();
      if (window.innerWidth < WIDE_MIN) panel.classList.add('folded');
      room();
      window.addEventListener('resize', () => { if (panel) setTimeout(room, 0); });
      setClock(false); hold(); try { updateScoreUI(); } catch (e) {}
      setInterval(hold, 500);
    }, 2500);
  }
  window.addEventListener('load', () => setTimeout(start, 1200));
})();
