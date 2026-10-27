// ══════════════════════════════════════════════
// CHALLENGE CARD LOOKS, the preview (r677, owner)
// ══════════════════════════════════════════════
// index.html?crfx starts a Classic run, lands a challenge card and shows a panel with
// the looks (CR_FX, js/challenge-round.js) as switches, plus demos that play a take, a
// raise, the 6s auto-take and the card's 60s clock at 10x. It is the real card on the
// real board: the tap, the double-tap, the payout and its flight are the game's own; a
// demo taps through onCardTap like a finger. Nothing is stored. The round clock is kept
// topped up; the card's own clock runs down to 6s and is refilled (r687: it used to be
// refilled at 30s, so its drain was never seen), except in the CLOCK demo, which lets it out.
const CRL_LOOKS = [
  ['press',  'Instant tap response',   'In the game. The card dips and clicks the moment you tap it; a take waits 0.5s for a second tap.'],
  ['prompt', 'Clearer cleared prompt', 'In the game. The cleared card reads TAP and 2-TAP with what each pays, over a bar that drains through the 6s before it takes the payout itself.'],
  ['take',   'Clearer take',           'In the game. A PAID stamp; the paid figure flies from the card’s pay line; the reward passed up is struck through.'],
  ['raise',  'Clearer raise',          'In the game. A STAGE 2 stamp; the ask rolls up and the new box drops in; the bigger reward lights; the border burns red while stage 1 is at risk.'],
  ['border', 'Clock on the border',    'Preview only. The 60s clock is a ring round the card that a hand sweeps away clockwise, red in the last 10s; the background stays lit. Off: the background drains.'],
];
let _crlGen = 0;   // a new card or demo cancels the one before
let _crlFast = 0;  // the CLOCK demo's timer
const CRL_GAME = { ...CR_FX };   // what the game ships, for TODAY'S LOOK

function crlCard() { return crCards().find(([, , cd]) => !cd.cr.done) || null; }
function crlWait(ms, gen) {
  return new Promise((res, rej) => setTimeout(() => (gen === _crlGen ? res() : rej('stale')), ms));
}

// A fresh two-stage hand ask in the cell nearest the board's middle, landing the
// way a marked cell's card lands.
function crlSpawn() {
  const gen = ++_crlGen;
  clearInterval(_crlFast); _crlFast = 0;
  crTele.slice().forEach(crTeleDrop);
  crQueue = [];
  crCards().forEach(([r, c, cd]) => { if (cd._crStamp) cd._crStamp.remove(); gridData[r][c] = drawCard() || null; });
  document.querySelectorAll('#grid .cr-stamp, #grid .cr-p').forEach(e => e.remove());
  render();
  let q;
  for (let k = 0; k < 80; k++) { q = crRollReq(1); if (q.kind === 'hand' && q.ladder.length === 2 && !q.touch) break; }
  const spots = crSpotsFor(q);
  if (!spots.length) return gen;
  const mr = (gridRows - 1) / 2, mc = (gridCols - 1) / 2, d = ([r, c]) => Math.abs(r - mr) + Math.abs(c - mc);
  spots.sort((a, b) => d(a) - d(b));
  const [r, c] = spots[0];
  const t = { r, c, src: 'spot', tier: 1, idx: 0, q, left: null };
  crTele.push(t);
  crLand(t);
  return gen;
}
function crlClear() {
  const h = crlCard(); if (!h) return false;
  const q = h[2].cr;
  if (q.banked === q.tier) return false;
  q.prog = crTarget(q); crAdvance(h[2]);
  return true;
}
// A tap as a finger makes it, with a ring on the card so a demo's taps can be seen.
function crlTap() {
  const h = crlCard() || crCards()[0]; if (!h) return;
  const el = crCardEl(h[2]);
  if (el) {
    const b = el.getBoundingClientRect(), m = document.createElement('div');
    m.className = 'crl-tap';
    m.style.left = (b.left + b.width / 2) + 'px'; m.style.top = (b.top + b.height * 0.62) + 'px';
    document.body.appendChild(m);
    setTimeout(() => m.remove(), 700);
  }
  onCardTap(h[0], h[1]);
}
async function crlDemo(kind) {
  const gen = crlSpawn();
  if (kind === 'clock') {
    // The card's own 60s in 6s, out to the end: the last 10s turn red and it fails.
    crlSay('Demo: the card\'s 60s clock at 10x, run all the way out.');
    _crlFast = setInterval(() => {
      if (gen !== _crlGen) { clearInterval(_crlFast); _crlFast = 0; return; }
      const h = crlCard(); if (!h) return;   // still landing, or done
      const q = h[2].cr;
      if (q.timeLeft > 1) { q.timeLeft -= 1; crRepaint(h[2]); }
    }, 100);
    return;
  }
  crlSay(kind === 'take' ? 'Demo: clear stage 1, then TAP.' : kind === 'raise' ? 'Demo: clear stage 1, then TAP TAP, then clear stage 2.' : 'Demo: clear stage 1, then wait.');
  try {
    await crlWait(1200, gen); crlClear();
    if (kind === 'wait') return;
    await crlWait(1900, gen); crlTap();
    if (kind === 'take') return;
    await crlWait(110, gen); crlTap();
    await crlWait(2600, gen); crlClear();
  } catch (e) { /* a newer card or demo took over */ }
}

// ── The panel ───────────────────────────────────────────────────────────────
function crlOpen() {
  if (document.getElementById('crl')) return;
  const p = document.createElement('div');
  p.id = 'crl';
  p.innerHTML = `<div class="crl-h">CHALLENGE CARD LOOKS</div>`
    + `<div class="crl-note">Tap the card to take, double-tap to raise. Turn a look off to see what it adds.</div>`
    + CRL_LOOKS.map(([k, name, what], i) => `<button class="crl-look" data-k="${k}"><span class="crl-sw"></span>`
      + `<span class="crl-t"><b>${i + 1}. ${name}</b><i>${what}</i></span></button>`).join('')
    + `<div class="crl-row"><button data-a="all">ALL ON</button><button data-a="none">TODAY'S LOOK</button></div>`
    + `<div class="crl-sub">WATCH</div>`
    + `<div class="crl-row"><button data-a="take">TAKE</button><button data-a="raise">RAISE</button><button data-a="wait">WAIT 6S</button><button data-a="clock">CLOCK ×10</button></div>`
    + `<div class="crl-sub">BY HAND</div>`
    + `<div class="crl-row"><button data-a="new">NEW CARD</button><button data-a="clear">CLEAR STAGE</button></div>`
    + `<div class="crl-say" id="crl-say"></div>`;
  document.body.appendChild(p);
  p.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.k) { crFxSet(b.dataset.k, !crFxOn(b.dataset.k)); crlPaint(); return; }
    const a = b.dataset.a;
    if (a === 'all' || a === 'none') { CRL_LOOKS.forEach(([k]) => crFxSet(k, a === 'all' || CRL_GAME[k])); crlPaint(); }
    else if (a === 'take' || a === 'raise' || a === 'wait' || a === 'clock') crlDemo(a);
    else if (a === 'new') { crlSpawn(); crlSay(''); }
    else if (a === 'clear') { if (!crlClear()) crlSay('Nothing to clear: the card is waiting for an answer, or gone. NEW CARD deals another.'); else crlSay(''); }
  });
  crlPaint(); crlPlace();
  window.addEventListener('resize', crlPlace);
}
function crlSay(t) { const s = document.getElementById('crl-say'); if (s) s.textContent = t; }
function crlPaint() {
  document.querySelectorAll('#crl .crl-look').forEach(b => b.classList.toggle('on', crFxOn(b.dataset.k)));
}
// Beside the board: over the info column in landscape, under the board on a phone.
function crlPlace() {
  const p = document.getElementById('crl'), st = document.getElementById('stage'), gs = document.getElementById('grid-slot');
  if (!p || !st || !gs) return;
  const s = st.getBoundingClientRect(), g = gs.getBoundingClientRect();
  if (st.classList.contains('landscape')) {
    Object.assign(p.style, { left: (s.left + 8) + 'px', top: (s.top + 8) + 'px', width: Math.max(220, g.left - s.left - 24) + 'px',
      height: '', maxHeight: (s.height - 16) + 'px', bottom: '' });
  } else {
    const top = Math.min(g.bottom + 6, innerHeight - 260);
    Object.assign(p.style, { left: (s.left + 6) + 'px', top: top + 'px', width: (s.width - 12) + 'px', maxHeight: (innerHeight - top - 6) + 'px' });
  }
}

// ── Entry ───────────────────────────────────────────────────────────────────
(function () {
  if (!/[?&]crfx\b/.test(location.search)) return;
  try { window.insightsOn = () => false; } catch (e) {}
  window.addEventListener('load', () => setTimeout(() => {
    try { devStartMode('normal'); } catch (e) {}
    setTimeout(() => {
      try { tutorialEnd(); } catch (e) {}
      try { coins = Math.max(coins, 40); updateCoinsUI?.(); } catch (e) {}
      try { crSpotState().at = null; } catch (e) {}
      crFxSet('border', true);   // r687: the look being asked about starts on
      crlOpen();
      crlSpawn();
      // Nothing runs out while the owner looks.
      setInterval(() => {
        if (typeof roundSeconds === 'number' && roundSeconds < 600) { roundSeconds = 3599; roundStartSeconds = 3599; updateClockUI?.(); }
        if (!_crlFast) crCards().forEach(([, , cd]) => { if (!cd.cr.done && crTimed(cd.cr.src) && cd.cr.timeLeft <= 6) cd.cr.timeLeft = CR_FLOW_TIME; });
        crlPlace();
      }, 1000);
    }, 2500);
  }, 1200));
})();
