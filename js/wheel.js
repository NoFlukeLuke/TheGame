// ══════════════════════════════════════════════════════════════════════════
// SPIN THE WHEEL — the Mart's second special slot.
//
// Pay BAL.wheel.cost to spin a 10-space wheel stocked with Tricks / Sleights /
// Knacks at the shop's rarity odds, plus one BUST (nothing) and one JACKPOT.
//
// The spin is a CLICK-AND-DRAG throw: flick the wheel and the release velocity
// sets the speed. Two rules keep it honest —
//   1. a floor on the total travel, so a limp flick still turns it right round;
//   2. a random extra force on every throw, so the landing can't be aimed.
// While it is spinning there is NO way out: the close button, the backdrop and
// Escape are all inert until the result has been applied.
//
// If a prize doesn't fit (Tricks are the only capped entity — trick_slots), the
// overflow prompt offers a choice: sell one of your Tricks to make room, or sell
// the prize itself.
// ══════════════════════════════════════════════════════════════════════════

let wheelActive   = false;
let wheelSpinning = false;
let wheelSlots    = [];
let wheelAngle    = 0;      // degrees, clockwise
let wheelResolved = true;   // false between "landed" and "prize applied"

// ── stock ────────────────────────────────────────────────────────────────────
// One BUST and one JACKPOT; the rest are real entities rolled on the shop's
// rarity table (martPick), so the wheel and the shelves feel like one economy.
function buildWheelSlots() {
  const n = BAL.wheel.slots;
  const out = [];
  const pickOne = () => {
    const r = Math.random();
    if (r < 0.45) return martTrickPayload(martPick(TRICK_POOL, 'tier', 1)[0]);
    if (r < 0.78) return martKnackPayload(martPick(KNACK_POOL, 'rarity', 1)[0]);
    return martSleightPayload(martPick(SLEIGHT_POOL.filter(sleightOfferable), 'rarity', 1)[0]);
  };
  for (let i = 0; i < n - 2; i++) out.push(pickOne());
  out.push({ type: 'bust', label: 'BUST', emoji: '✖', rarity: 'common', desc: 'Nothing. Better luck next spin.' });
  out.push(buildJackpot(pickOne));
  // shuffle so BUST and JACKPOT aren't always the last two spaces
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// The jackpot space is one of: two items, an upgraded item, or a pile of credits.
function buildJackpot(pickOne) {
  const roll = Math.floor(Math.random() * 3);
  if (roll === 0) {
    const a = pickOne(), b = pickOne();
    return { type: 'jackpot', jackpot: 'double', items: [a, b], label: 'JACKPOT', emoji: '★',
             rarity: 'mythic', desc: `Two prizes at once: ${a.label} + ${b.label}.` };
  }
  if (roll === 1) {
    const a = pickOne();
    return { type: 'jackpot', jackpot: 'upgrade', items: [a], label: 'JACKPOT', emoji: '★',
             rarity: 'mythic', desc: `${a.label}, upgraded a rarity tier.` };
  }
  return { type: 'jackpot', jackpot: 'coins', label: 'JACKPOT', emoji: '★', rarity: 'mythic',
           coins: BAL.wheel.jackpot_coins, desc: `${BAL.wheel.jackpot_coins} credits.` };
}

// ── overlay ──────────────────────────────────────────────────────────────────
const WHEEL_RARITY_COLOR = { common:'--c-mint', rare:'--c-cyan', epic:'--c-purple', legendary:'--c-yellow', mythic:'--c-magenta' };
function wheelSliceColor(p) { return `var(${WHEEL_RARITY_COLOR[p.rarity] || '--c-mint'})`; }

function ensureWheelOverlay() {
  let el = document.getElementById('wheel-overlay');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'wheel-overlay';
  el.innerHTML = `
    <div class="wh-box">
      <div class="wh-bar">
        <span class="wh-title">SPIN THE WHEEL</span>
        <button class="wh-close" id="wheel-close">&#10005;</button>
      </div>
      <div class="wh-stage">
        <div class="wh-pointer">&#9660;</div>
        <div class="wh-wheel" id="wheel-disc">
          <div class="wh-face" id="wheel-face"></div>
          <div class="wh-labels" id="wheel-labels"></div>
          <div class="wh-hub">SPIN</div>
        </div>
      </div>
      <div class="wh-hint" id="wheel-hint">Grab the wheel and flick it &mdash; the harder you throw, the longer it runs.</div>
      <div class="wh-result" id="wheel-result"></div>
      <div class="wh-confirm" id="wheel-confirm">
        <div class="wh-cost">Spin the wheel for <b id="wheel-cost">20</b> &#128176;</div>
        <div class="wh-cbtns">
          <button class="wh-cancel" id="wheel-cancel">CANCEL</button>
          <button class="wh-go" id="wheel-go">SPIN &mdash; PAY <span id="wheel-cost2">20</span></button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(el);
  el.querySelector('#wheel-close').onclick = closeWheel;
  el.querySelector('#wheel-cancel').onclick = closeWheel;
  el.querySelector('#wheel-go').onclick = confirmWheelSpin;
  // Backdrop click also blocked while spinning (see closeWheel's guard).
  el.addEventListener('pointerdown', e => { if (e.target === el) closeWheel(); });
  bindWheelDrag(el.querySelector('#wheel-disc'));
  return el;
}

// Opening only PREVIEWS the wheel — you can see what's on it, and nothing is
// charged until you confirm. Credits leave your pocket in confirmWheelSpin().
let wheelPaid = false;
function openWheel() {
  if (wheelActive) return;
  const cost = BAL.wheel.cost;
  if (coins < cost) { showMessage(`The wheel costs ${cost} credits`, 'var(--red)'); return; }
  wheelActive = true; wheelSpinning = false; wheelResolved = true; wheelPaid = false;
  wheelSlots = buildWheelSlots();
  wheelAngle = Math.random() * 360;
  const el = ensureWheelOverlay();
  renderWheel();
  el.querySelector('#wheel-cost').textContent  = cost;
  el.querySelector('#wheel-cost2').textContent = cost;
  el.classList.add('show');
  el.classList.add('unpaid');            // gates the drag + shows the confirm bar
  document.getElementById('wheel-hint').textContent = 'Have a look at what\u2019s on it first.';
  document.getElementById('wheel-result').innerHTML = '';
  try { sfxShopOpen && sfxShopOpen(); } catch (e) {}
}

// The confirm step: this is where the credits actually go.
function confirmWheelSpin() {
  if (wheelPaid) return;
  const cost = BAL.wheel.cost;
  if (coins < cost) { showMessage('Not enough credits', 'var(--red)'); return; }
  coins -= cost; updateCoinsUI();
  wheelPaid = true;
  document.getElementById('wheel-overlay')?.classList.remove('unpaid');
  document.getElementById('wheel-hint').textContent = 'Grab the wheel and flick it \u2014 the harder you throw, the longer it runs.';
  if (typeof renderMart === 'function' && martActive) renderMart();
}

// Refuses to close mid-spin and until the prize has actually been handed over.
function closeWheel() {
  if (!wheelActive) return;
  if (wheelSpinning || !wheelResolved) {
    showMessage('Not until the wheel stops', 'var(--red)');
    return;
  }
  wheelActive = false;
  const el = document.getElementById('wheel-overlay');
  el?.classList.remove('show');
  el?.classList.remove('unpaid');
  wheelPaid = false;
}

function renderWheel() {
  const n = wheelSlots.length, step = 360 / n;
  const face = document.getElementById('wheel-face');
  const labels = document.getElementById('wheel-labels');
  if (!face || !labels) return;
  // Slices as a conic gradient — one hard stop per space.
  face.style.background = 'conic-gradient(' + wheelSlots.map((p, i) => {
    const c = p.type === 'bust' ? 'rgba(40,34,24,0.95)'
            : p.type === 'jackpot' ? 'var(--c-magenta)'
            : `color-mix(in srgb, ${wheelSliceColor(p)} 34%, #0b0906)`;
    return `${c} ${(i * step).toFixed(2)}deg ${((i + 1) * step).toFixed(2)}deg`;
  }).join(',') + ')';
  labels.innerHTML = wheelSlots.map((p, i) => {
    const mid = i * step + step / 2;
    const name = p.type === 'jackpot' ? 'JACKPOT' : p.type === 'bust' ? 'BUST' : p.label;
    return `<div class="wh-slot" style="transform:rotate(${mid}deg) translateY(-96px)">
      <div class="wh-slot-in" style="transform:rotate(${-mid}deg)">
        <div class="wh-emoji">${p.emoji || '?'}</div>
        <div class="wh-name">${name}</div>
      </div></div>`;
  }).join('');
  // Each space explains itself on hover — you should be able to read the wheel
  // before deciding to pay for it.
  labels.querySelectorAll('.wh-slot').forEach((el, i) => {
    const p = wheelSlots[i];
    attachEntityTooltip(el.querySelector('.wh-slot-in') || el, () => ({
      label: p.type === 'jackpot' ? 'JACKPOT' : p.type === 'bust' ? 'BUST' : p.label,
      desc: p.desc, rarity: p.rarity, type: p.type === 'jackpot' || p.type === 'bust' ? '' : p.type,
    }));
  });
  fitEntityNames(labels, '.wh-name', { maxLines: 2, minPx: 5 });
  applyWheelAngle();
}

function applyWheelAngle() {
  const disc = document.getElementById('wheel-disc');
  if (disc) disc.style.transform = `rotate(${wheelAngle}deg)`;
}

// ── drag to spin ─────────────────────────────────────────────────────────────
// Pointer angle is measured clockwise from 12 o'clock so it matches slice order.
let _whDrag = null;
function wheelPointerAngle(disc, e) {
  const r = disc.getBoundingClientRect();
  return Math.atan2(e.clientX - (r.left + r.width / 2),
                    -(e.clientY - (r.top + r.height / 2))) * 180 / Math.PI;
}
function angleDelta(a, b) { let d = a - b; while (d > 180) d -= 360; while (d < -180) d += 360; return d; }

function bindWheelDrag(disc) {
  disc.addEventListener('pointerdown', e => {
    if (wheelSpinning || !wheelResolved) return;
    if (!wheelPaid) { showMessage('Confirm the spin first', 'var(--cream-dim)'); return; }
    disc.setPointerCapture(e.pointerId);
    _whDrag = { last: wheelPointerAngle(disc, e), samples: [{ t: performance.now(), a: wheelAngle }] };
    disc.classList.add('grabbing');
    e.preventDefault();
  });
  disc.addEventListener('pointermove', e => {
    if (!_whDrag) return;
    const a = wheelPointerAngle(disc, e);
    wheelAngle += angleDelta(a, _whDrag.last);
    _whDrag.last = a;
    _whDrag.samples.push({ t: performance.now(), a: wheelAngle });
    if (_whDrag.samples.length > 12) _whDrag.samples.shift();
    applyWheelAngle();
  });
  const release = e => {
    if (!_whDrag) return;
    disc.classList.remove('grabbing');
    try { disc.releasePointerCapture(e.pointerId); } catch (err) {}
    const s = _whDrag.samples;
    _whDrag = null;
    // deg/s over the last ~120ms of the drag
    let v0 = 0;
    const now = performance.now();
    const first = s.find(p => now - p.t < 140) || s[0];
    const last = s[s.length - 1];
    const dt = (last.t - first.t) / 1000;
    if (dt > 0.008) v0 = (last.a - first.a) / dt;
    spinWheel(v0);
  };
  disc.addEventListener('pointerup', release);
  disc.addEventListener('pointercancel', release);
}

// Coast-down is exponential: travel(t) = TOTAL * (1 - e^(-k t)). Because TOTAL is
// known up front, the floor and the random force can both be applied to it
// directly — which is what makes "always at least one full turn" a guarantee
// rather than a hope.
const WHEEL_K = 1.5;
function spinWheel(v0) {
  if (wheelSpinning) return;
  const dir = v0 < 0 ? -1 : 1;
  let total = Math.abs(v0) / WHEEL_K;
  total *= 0.9 + Math.random() * 0.35;          // random force — can't be aimed
  total += 140 + Math.random() * 260;
  total = Math.max(total, 720 + Math.random() * 360);   // never fewer than two turns
  total *= dir;

  wheelSpinning = true; wheelResolved = false;
  const hint = document.getElementById('wheel-hint');
  const res  = document.getElementById('wheel-result');
  if (hint) hint.textContent = 'Spinning…';
  if (res)  res.innerHTML = '';
  document.getElementById('wheel-overlay')?.classList.add('spinning');

  const start = wheelAngle;
  const T = Math.log(500) / WHEEL_K * 1000;     // ms until it has effectively stopped
  const t0 = performance.now();
  function frame(now) {
    const t = (now - t0) / 1000;
    if ((now - t0) >= T) {
      wheelAngle = start + total;
      applyWheelAngle();
      wheelSpinning = false;
      document.getElementById('wheel-overlay')?.classList.remove('spinning');
      landWheel();
      return;
    }
    wheelAngle = start + total * (1 - Math.exp(-WHEEL_K * t));
    applyWheelAngle();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// Which space sits under the pointer at 12 o'clock.
function wheelWinningIndex() {
  const n = wheelSlots.length, step = 360 / n;
  const a = ((-wheelAngle % 360) + 360) % 360;
  return Math.floor(a / step) % n;
}

function landWheel() {
  const p = wheelSlots[wheelWinningIndex()];
  const res  = document.getElementById('wheel-result');
  const hint = document.getElementById('wheel-hint');
  if (hint) hint.textContent = '';
  if (res) {
    res.innerHTML = `<div class="wh-won ${p.type}"><span class="wh-won-em">${p.emoji || '?'}</span>
      <div><div class="wh-won-name">${p.type === 'bust' ? 'BUST' : p.label}</div>
      <div class="wh-won-desc">${p.desc || ''}</div></div></div>`;
  }
  try { (p.type === 'bust' ? sfxRewardBad : sfxRewardGood)(); } catch (e) {}
  awardWheelPrize(p);
}

// ── awarding ─────────────────────────────────────────────────────────────────
function wheelPrizeFits(p) {
  // Tricks are the only entity with a cap (the trick_slots limit).
  if (p.type === 'trick' && trickTrayMode) return trickTray.length < trickCapacity();
  return true;
}

// A prize's own sell price if its type has one, else BAL.wheel.default_sell.
function wheelPrizeSellValue(p) {
  if (p.type === 'trick' && typeof trickSellValue === 'function') return trickSellValue(p.ref);
  if (p.type === 'knack' && typeof knackSellValue === 'function') return knackSellValue();
  return BAL.wheel.default_sell;
}

function awardWheelPrize(p) {
  if (p.type === 'bust') { finishWheelPrize('Nothing this time.'); return; }

  if (p.type === 'jackpot') {
    if (p.jackpot === 'coins') { coins += p.coins; updateCoinsUI(); finishWheelPrize(`+${p.coins} credits!`); return; }
    if (p.jackpot === 'upgrade') {
      const item = p.items[0];
      // "Upgraded" = bumped a rarity tier for the payout it represents. The pools
      // are fixed content, so this is expressed as the item plus a credit kicker
      // equal to the tier step. TBD: real per-entity upgrade levels (see
      // ENTITY_IMPROVEMENTS.md) — swap this out when that lands.
      const bonus = Math.round((item.price || 10) * 0.5);
      coins += bonus; updateCoinsUI();
      awardWheelItems([item], `${item.label} +${bonus} credits (upgraded)`);
      return;
    }
    awardWheelItems(p.items, `${p.items.map(i => i.label).join(' + ')}`);
    return;
  }
  awardWheelItems([p], p.label);
}

// Hand over a list of prizes, pausing on the first that doesn't fit.
function awardWheelItems(items, msg) {
  const queue = items.slice();
  (function next() {
    if (!queue.length) { finishWheelPrize(msg); return; }
    const item = queue.shift();
    if (wheelPrizeFits(item)) {
      try { item.buy(); } catch (e) { console.error('[WHEEL] award failed', e); }
      next();
    } else {
      openWheelOverflow(item, next);
    }
  })();
}

function finishWheelPrize(msg) {
  wheelResolved = true;
  const hint = document.getElementById('wheel-hint');
  if (hint) hint.innerHTML = `<button class="wh-done" onclick="closeWheel()">TAKE IT AND GO</button>`;
  if (msg) showMessage(msg, 'var(--gold)');
  if (typeof renderMart === 'function' && martActive) renderMart();
}

// ── overflow: the prize doesn't fit ──────────────────────────────────────────
// Two ways out, and only these two — the wheel still won't let you leave.
let _whOverflowNext = null;
function openWheelOverflow(item, next) {
  _whOverflowNext = next;
  let el = document.getElementById('wheel-overflow');
  if (!el) {
    el = document.createElement('div');
    el.id = 'wheel-overflow';
    document.body.appendChild(el);
  }
  const cap = trickCapacity();
  const sell = wheelPrizeSellValue(item);
  el.innerHTML = `
    <div class="wo-box">
      <div class="wo-title">NO ROOM</div>
      <div class="wo-sub">You won <b>${item.label}</b>, but your Trick slots are full (${trickTray.length}/${cap}).</div>
      <div class="wo-lead">Sell one to make room&hellip;</div>
      <div class="wo-tricks">${trickTray.map((t, i) =>
        `<button class="wo-trick" data-i="${i}">
           <span class="wo-tem">${trickEmoji(t)}</span>
           <span class="wo-tn">${t.name}</span>
           <span class="wo-tv">+${trickSellValue(t)}</span>
         </button>`).join('')}</div>
      <div class="wo-or">or</div>
      <button class="wo-sell-prize">SELL ${item.label.toUpperCase()} &middot; +${sell} credits</button>
    </div>`;
  // Grab the continuation BEFORE closing — closeWheelOverflow() clears
  // _whOverflowNext, and losing it would strand the wheel un-exitable.
  el.querySelectorAll('.wo-trick').forEach(b => b.onclick = () => {
    const t = trickTray[+b.dataset.i];
    if (!t) return;
    const cont = _whOverflowNext;
    sellTrick(t);                       // frees a slot and pays out
    closeWheelOverflow();
    try { item.buy(); } catch (e) { console.error('[WHEEL] award failed', e); }
    showMessage(`${item.label} claimed`, 'var(--gold)');
    if (cont) cont();
  });
  el.querySelector('.wo-sell-prize').onclick = () => {
    const cont = _whOverflowNext;
    coins += sell; updateCoinsUI();
    closeWheelOverflow();
    showMessage(`Sold ${item.label} · +${sell} credits`, 'var(--gold)');
    if (cont) cont();
  };
  el.classList.add('show');
}
function closeWheelOverflow() {
  document.getElementById('wheel-overflow')?.classList.remove('show');
  _whOverflowNext = null;
}
