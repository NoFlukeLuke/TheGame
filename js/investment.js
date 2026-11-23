// ── THE INVESTMENT (event id `altar`, frozen; r805, owner) ──────────────────
// Two ways to invest, both held until the NEXT QUARTER opens (a review beaten in
// Flow, the quarter card elsewhere):
//   CREDITS - every credit you hold goes in. When the quarter opens one outcome is
//             rolled (INVEST.outcomes): +5% a level, +10% a level, +20% a level
//             (compounding over the levels passed since) or half of it back.
//   A TRICK - a Trick and an amount. The Trick is switched off until the quarter
//             opens (altarTrickLocked, read by isTrickDisabledByBoss and the sells).
//             Every round that starts meanwhile has credits x INVEST.trickPerCoin %
//             to improve it (improveEntity, so the improvement scene plays). The
//             credits are spent. Not printed anywhere (owner): everything you hold,
//             INVEST.guaranteeMin or more, is at least one improvement.
// The result prints on a board screen ("> INVESTMENT") right after the quarter
// card, or before Flow's post-review rewards, before anything else happens
// (investmentReportMaybe). `investment` is in SAVE_VARS; the credits are paid the
// moment the quarter turns (investmentSettle), so a run that ends there still has
// them, and the report only reads what was paid.
const INVEST = {
  trickPerCoin: 2,       // % per credit, each round, to improve the invested Trick
  guaranteeMin: 10,      // all your credits, this many or more: one improvement at least (unprinted)
  outcomes: [            // the credits roll, weights in `p`
    { p: 60, rate: 0.05 },
    { p: 10, rate: 0.10 },
    { p: 10, rate: 0.20 },
    { p: 20, half: true },
  ],
  reportMs: 5200,        // the report continues on its own after this
};
let investment = null;       // { kind:'credits', credits, level, q } | { kind:'trick', trickId, name, credits, all, level, q, ups, rounds, lastLevel }
let _investReport = null;    // the settled result, until it has been shown
function investmentReset() { investment = null; _investReport = null; }
function investmentLive() { return !!investment; }
// Offered only with credits to invest and nothing already invested (EVENT_REQUIRES).
function investmentOfferable() { return !investment && (coins | 0) >= 1; }
function investmentTrickLocked(id) { return !!(investment && investment.kind === 'trick' && investment.trickId === id); }
function investQuarter() { return (typeof qrlQuarter === 'function') ? qrlQuarter() : 1; }
function investTrickCandidates() {
  return (trickTray || []).filter(t => t && t.id && typeof canImprove === 'function' && canImprove(t.id));
}

// ── The event ────────────────────────────────────────────────────────────────
function renderAltar() {
  const body = document.getElementById('event-body');
  eventState.invKind = null; eventState.invTrick = null; eventState.invAmt = coins | 0;
  if (!investmentOfferable()) { body.innerHTML = evEmptyHTML(investment ? 'An investment is already held.' : 'Nothing to invest.'); setEventConfirm(false); return; }
  const q = investQuarter();
  const [o1, o2, o3, o4] = INVEST.outcomes;
  const pick = (kind) => {
    eventState.invKind = kind;
    body.querySelectorAll('.event-choice.inv-opt').forEach(e => e.classList.toggle('selected', e.dataset.kind === kind));
    body.querySelector('.inv-trick-panel').style.display = kind === 'trick' ? '' : 'none';
    invSync();
  };
  const all = makeChoiceEl({ icon: '🏦', rarity: 'rare', name: `Invest ${creditsTxt(coins)}`, cls: 'inv-opt',
    desc: `Every credit you hold, until Q${q + 1} opens. Then: ${o1.p}% +${Math.round(o1.rate * 100)}% a level · ${o2.p}% +${Math.round(o2.rate * 100)}% a level · ${o3.p}% +${Math.round(o3.rate * 100)}% a level · ${o4.p}% half back. The levels compound.`,
    onClick: () => pick('credits') });
  all.dataset.kind = 'credits';
  body.appendChild(all);
  const cands = investTrickCandidates();
  const tr = makeChoiceEl({ icon: '📈', rarity: 'epic', name: 'Invest a Trick', cls: 'inv-opt',
    desc: cands.length ? `A Trick and an amount. The Trick is off until Q${q + 1} opens. Every level that starts before then it has ${INVEST.trickPerCoin}% per credit to improve.`
                       : 'No Trick of yours can improve.',
    onClick: () => { if (cands.length) pick('trick'); } });
  tr.dataset.kind = 'trick';
  if (!cands.length) tr.classList.add('inv-off');
  body.appendChild(tr);
  // The Trick row and the amount, shown under the second option once it is picked.
  const panel = document.createElement('div');
  panel.className = 'inv-trick-panel'; panel.style.display = 'none';
  panel.appendChild(evLabel('WHICH TRICK'));
  const row = document.createElement('div'); row.className = 'ev-draw-list inv-tricks';
  cands.forEach(t => {
    const em = (typeof trickEmoji === 'function') ? trickEmoji(t) : '✦';
    const tier = (typeof entityTierOf === 'function') ? entityTierOf(t.id) : 0;
    const el = makeChoiceEl({ icon: em, rarity: t.tier, tile: { entity: 'trick', id: t.id, emoji: em, label: t.name },
      name: (typeof shownEntityName === 'function') ? shownEntityName(t, 'trick') : t.name, desc: `v${tier + 1}.0`, cls: 'ev-draw-opt inv-trick',
      onClick: () => { eventState.invTrick = t; row.querySelectorAll('.inv-trick').forEach(e => e.classList.toggle('selected', e === el)); invSync(); } });
    row.appendChild(el);
  });
  panel.appendChild(row);
  panel.appendChild(evLabel('HOW MUCH'));
  const amt = document.createElement('div'); amt.className = 'inv-amount';
  amt.innerHTML = `<input type="range" class="inv-range" min="1" max="${coins | 0}" value="${coins | 0}" step="1">`
    + `<span class="inv-amt-read"></span><button type="button" class="ev-btn inv-all">ALL</button>`;
  panel.appendChild(amt);
  body.appendChild(panel);
  const range = amt.querySelector('.inv-range'), read = amt.querySelector('.inv-amt-read');
  range.addEventListener('input', () => { eventState.invAmt = +range.value; invSync(); });
  amt.querySelector('.inv-all').addEventListener('click', () => { range.value = String(coins | 0); eventState.invAmt = coins | 0; invSync(); });
  function invSync() {
    const n = Math.max(1, Math.min(coins | 0, eventState.invAmt | 0));
    read.textContent = `${creditsTxt(n)} · ${Math.min(100, n * INVEST.trickPerCoin)}% a level`;
    const ok = eventState.invKind === 'credits' || (eventState.invKind === 'trick' && !!eventState.invTrick);
    evConfirmBtn(eventState.invKind === 'credits' ? `INVEST ${creditsTxt(coins | 0)}` : eventState.invKind === 'trick' ? `INVEST ${creditsTxt(n)}` : 'Confirm', ok);
  }
  invSync();
}

function confirmAltar() {
  const kind = eventState.invKind;
  const q = investQuarter();
  if (kind === 'credits' && (coins | 0) >= 1) {
    const c = coins | 0;
    investment = { kind: 'credits', credits: c, level, q };
    coins = 0;
    noteMessage(`${creditsTxt(c)} invested until Q${q + 1}`);
  } else if (kind === 'trick' && eventState.invTrick) {
    const t = eventState.invTrick, c = Math.max(1, Math.min(coins | 0, eventState.invAmt | 0));
    investment = { kind: 'trick', trickId: t.id, name: t.name, credits: c, all: c === (coins | 0), level, q, ups: 0, rounds: 0, lastLevel: level };
    coins -= c;
    noteMessage(`${t.name} invested with ${creditsTxt(c)} until Q${q + 1}`);
    if (typeof hideTrickTooltip === 'function') hideTrickTooltip();
    if (typeof renderTrickTray === 'function') renderTrickTray();
  }
  if (typeof updateCoinsUI === 'function') updateCoinsUI();
  closeEvent();
}

// ── Every round that starts: the Trick's roll (startRoundTimer, once a level) ──
function investmentRoundStart() {
  const inv = investment;
  if (!inv || inv.kind !== 'trick' || inv.lastLevel === level) return;
  inv.lastLevel = level; inv.rounds++;
  if (typeof canImprove !== 'function' || !canImprove(inv.trickId)) return;
  const p = Math.min(100, inv.credits * INVEST.trickPerCoin);
  if (Math.random() * 100 < p) {
    inv.ups++;
    if (typeof improveEntity === 'function') improveEntity(inv.trickId);
    if (typeof entityPing === 'function') entityPing('trick', inv.trickId);
    noteMessage(`${inv.name} improved (invested)`);
  }
}

// ── The quarter turns: pay out, and keep the report for the screen ───────────
function investmentSettle() {
  const inv = investment;
  if (!inv) return null;
  investment = null;
  let rep;
  if (inv.kind === 'credits') {
    const levels = Math.max(0, (level | 0) - (inv.level | 0));
    const tot = INVEST.outcomes.reduce((s, o) => s + o.p, 0);
    let r = Math.random() * tot, out = INVEST.outcomes[0];
    for (const o of INVEST.outcomes) { if (r < o.p) { out = o; break; } r -= o.p; }
    const amount = out.half ? Math.floor(inv.credits / 2) : Math.round(inv.credits * Math.pow(1 + out.rate, levels));
    coins += amount;
    rep = { kind: 'credits', credits: inv.credits, levels, out, amount };
    noteMessage(`Investment: ${creditsTxt(inv.credits)} returned ${creditsTxt(amount)}`);
  } else {
    // The unprinted guarantee: everything you had, INVEST.guaranteeMin or more, improves once at least.
    if (inv.all && inv.credits >= INVEST.guaranteeMin && inv.ups === 0 && typeof canImprove === 'function' && canImprove(inv.trickId)) {
      inv.ups = 1;
      if (typeof improveEntity === 'function') improveEntity(inv.trickId);
    }
    rep = { kind: 'trick', name: inv.name, trickId: inv.trickId, credits: inv.credits, ups: inv.ups, rounds: inv.rounds };
    noteMessage(`Investment: ${inv.name} is back` + (inv.ups ? `, improved ${inv.ups === 1 ? 'once' : inv.ups + ' times'}` : ''));
    if (typeof renderTrickTray === 'function') renderTrickTray();
  }
  if (typeof updateCoinsUI === 'function') updateCoinsUI();
  _investReport = rep;
  return rep;
}

// ── The report: a typed board screen, then `done` ───────────────────────────
function investmentReportMaybe(done) {
  const rep = _investReport;
  _investReport = null;
  const go = () => { if (typeof done === 'function') done(); };
  if (!rep || typeof boardScreenOpen !== 'function' || !(typeof bsStage === 'function' && bsStage())) { go(); return; }
  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const lines = [];
  if (rep.kind === 'credits') {
    lines.push(`${creditsTxt(rep.credits)} INVESTED · ${rep.levels} LEVEL${rep.levels === 1 ? '' : 'S'}`);
    lines.push(rep.out.half ? 'HALF BACK' : `+${Math.round(rep.out.rate * 100)}% A LEVEL`);
    lines.push(`&gt; RETURNED ${creditsTxt(rep.amount)}`);
  } else {
    lines.push(`${esc(rep.name.toUpperCase())} · ${creditsTxt(rep.credits)} · ${rep.rounds} LEVEL${rep.rounds === 1 ? '' : 'S'}`);
    lines.push(rep.ups ? `IMPROVED ${rep.ups === 1 ? 'ONCE' : rep.ups === 2 ? 'TWICE' : rep.ups + ' TIMES'}` : 'NOT IMPROVED');
    lines.push(`&gt; ${esc(rep.name.toUpperCase())} IS BACK`);
  }
  const html = `<div class="inv-wrap">${lines.map((l, i) => `<div class="inv-line${i === lines.length - 1 ? ' inv-last' : ''}">${l}</div>`).join('')}</div>`;
  let finished = false, timer = null;
  const finish = () => { if (finished) return; finished = true; clearTimeout(timer); try { ctl.close(); } catch (e) {} setTimeout(go, 180); };
  const ctl = boardScreenOpen({ head: '> INVESTMENT', html, cls: 'inv-screen', keys: [{ label: 'CONTINUE', primary: true, fn: finish }], onClose: finish });
  if (!ctl) { go(); return; }
  ctl.typeSound = true;
  const els = [...ctl.body.querySelectorAll('.inv-line')];
  els.forEach(e => { e.style.visibility = 'hidden'; });
  let typing = true;
  (async () => {
    for (const e of els) { if (finished) return; e.style.visibility = ''; await bsType(e, ctl); }
    typing = false;
    try { if (typeof sfxRewardTaken === 'function' && rep.kind === 'credits' && !rep.out.half) sfxRewardTaken(); } catch (e) {}
    timer = setTimeout(finish, INVEST.reportMs);
  })();
  // A tap while it types finishes the typing (ctl.finishTyping, the screen's own); after that it continues.
  ctl.el.addEventListener('pointerdown', () => { if (typing) { if (ctl.finishTyping) ctl.finishTyping(); } else finish(); }, true);
}
