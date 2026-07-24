async function startInterlude() {
  interludeActive = true;

  // Duck gain was set up by goal-reach (set to 0.4). Reuse it; lazy-init if missing.
  const ctx = getAudioCtx();
  if (!sfxDuckGain) {
    sfxDuckGain = ctx.createGain();
    sfxDuckGain.gain.setValueAtTime(0.4, ctx.currentTime);
    sfxDuckGain.connect(ctx.destination);
  }

  // ── Stage 1: skip Success flash — goalCelebration already showed SUCCESS + confetti ──
  // Cards fall out next.
  const gridEl = document.getElementById('grid');

  // ── Stage 5: cards fall out ──
  await showLevelUpScreen_fallOnly();

  // ── Fade in the ONE continuous dark bg — stays up through payout, Trick pick, goal flash, 321 ──
  document.getElementById('next-goal-bg').classList.add('show');
  await new Promise(res => setTimeout(res, 300));

  // ── Stage 4: Balatro-style payout UI ──
  await showPayoutUI();

  interludeActive = false;
  sfxDuckGain.disconnect();
  sfxDuckGain = null;

  // ── Reward grid replaces Trick choice — player picks spoils, then new round setup runs ──
  rewardGridContext = 'interlude';
  openRewardGrid();
}

async function showLevelUpScreen_fallOnly() {
  // Just the fall-out phase — every card (including Tricks) visually falls.
  // Tricks' positions are preserved in gridData so showLevelUpScreen can refill them in place.
  animating = true;
  selected = [];

  // ── Focus meter notch/dot fall (chunk 2 item 4) ──
  // Fire focus fall ~150ms BEFORE card fall so notches leave first (small stagger).
  // Collect lit dots and filled nodes, spawn fall clones, then zero focusNodes silently.
  const FOCUS_LEAD_MS = 150;
  if (focusNodes > 0) {
    const cap = focusCapacity * FOCUS_THRESHOLD;
    const total = Math.min(focusNodes, cap);

    // Every filled node falls, highest first.
    const filledNodes = [];
    for (let i = total - 1; i >= 0; i--) {
      const n = focusNodeEls[i];
      if (n) filledNodes.push(n);
    }
    filledNodes.forEach((n, i) => spawnFocusFallClone(n, { delay: i * 20 }));

    // Zero state silently — the real DOM goes dark immediately while clones fall.
    focusNodes = 0;
    focusAnimQueue = [];
    focusAnimRunning = false;
    syncFocusMeterState();
    updateFocusMultReadout(false);

    // Brief lead before card fall begins
    await new Promise(res => setTimeout(res, FOCUS_LEAD_MS));
  }

  const gridEl = document.getElementById('grid');
  const gridBottom = gridEl.offsetHeight + 80;
  const fallPromises = [];

  // Snapshot Trick positions before the fall
  const preservedTricks = [];
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      if (gridData[r][c]?._isTrick) preservedTricks.push({ r, c, card: gridData[r][c] });
    }
  }

  for (let r = gridRows - 1; r >= 0; r--) {
    for (let c = 0; c < gridCols; c++) {
      const card = gridData[r][c];
      if (!card) continue;
      const el = gridEl.querySelector(`[data-card-id="${card._id}"]`);
      if (!el) continue;
      const delay = (gridRows - 1 - r) * 110 + c * 30;
      const fallDist = gridBottom - parseFloat(el.style.top || cellTop(r));
      fallPromises.push(new Promise(res => {
        setTimeout(() => {
          el.style.transition = `top 0.7s cubic-bezier(0.4,0,1,1) ${delay}ms, opacity 0.4s ease-in ${delay + 400}ms`;
          el.style.top = (cellTop(r) + fallDist) + 'px';
          el.style.opacity = '0';
          setTimeout(res, delay + 750);
        }, 0);
      }));
    }
    for (let c = 0; c < gridCols; c++) {
      const card = gridData[r][c];
      if (card && !card._isTrick) {
        discardToPlayed(card);
        gridData[r][c] = null; // clear immediately so HUD reflects the move
      }
    }
    updateDeckHud();
  }
  await Promise.all(fallPromises);
  flushPlayedDeck();

  // Clear DOM (every card fell)
  gridEl.querySelectorAll('[data-card-id]').forEach(el => el.remove());

  // Reset gridData; Tricks get restored to their snapshotted positions for refill
  gridData = Array.from({length:gridRows}, () => Array(gridCols).fill(null));
  preservedTricks.forEach(({r, c, card}) => { gridData[r][c] = card; });
  trickCardPos = null;
  animating = false;
}

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

async function showPayoutUI() {
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // Calculate payouts
  // Idol: triple interest if still on the board at round end (consumes one charge)
  let interestMult = 1;
  if (hasSleightOnGrid('idol')) {
    interestMult = BAL.idol.interest_mult;
    for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
      const card = gridData[r]?.[c];
      if (card?._isSleight && card.sleightId === 'idol') { consumeSleightCharge(card, r, c); }
    }
    showMessage('🗿 Idol — triple interest!', 'var(--gold)');
  }
  const interestCoins  = Math.floor(coins / 10) * interestMult;
  const efficiencyCoins = Math.floor(frozenRoundSeconds / 10);
  const totalCoins     = interestCoins + efficiencyCoins;
  // Show the Idol's tripled interest right on the payout breakdown.
  const interestName = interestMult > 1 ? `Interest <span style="color:#f5c042;">🗿 ×${interestMult}</span>` : 'Interest';
  const interestDesc = interestMult > 1
    ? `10% of <span style="color:#f5c042;">◆ ${coins}</span> × ${interestMult} (Idol)`
    : `10% of <span style="color:#f5c042;">◆ ${coins}</span>`;

  // Build overlay
  const el = document.createElement('div');
  el.id = 'payout-overlay';
  el.innerHTML = `
    <div class="payout-title">Payout</div>
    <div class="payout-tabs">
      <button class="payout-tab active" id="po-tab-payout-btn">Payout</button>
      <button class="payout-tab" id="po-tab-contrib-btn">Contributions</button>
    </div>
    <div id="po-view-contrib" class="po-view" style="display:none">
      <div class="contrib-head">This round · ${roundHandsScored} hand${roundHandsScored===1?'':'s'} scored</div>
      <div class="contrib-scroll">${roundContributionRowsHTML()}</div>
    </div>
    <div id="po-view-payout" class="po-view">
    <div class="payout-lines">
      <div class="payout-line" id="po-line-interest">
        <div class="pl-left">
          <div class="pl-name">${interestName}</div>
          <div class="pl-desc">${interestDesc}</div>
        </div>
        <div class="pl-right">
          <span class="pl-coins" id="po-interest">0</span>
          <span class="pl-sym">◆</span>
        </div>
      </div>
      <div class="payout-line" id="po-line-efficiency">
        <div class="pl-left">
          <div class="pl-name">Efficiency</div>
          <div class="pl-desc">1 per 10s remaining</div>
        </div>
        <div class="pl-right">
          <span class="pl-clock" id="po-clock">${formatTime(frozenRoundSeconds)}</span>
          <span class="pl-coins" id="po-efficiency">0</span>
          <span class="pl-sym">◆</span>
        </div>
      </div>
    </div>
    <div class="payout-divider" id="po-divider"></div>
    <div class="payout-total" id="po-total">
      <span class="pt-label">Total</span>
      <span class="pt-coins" id="po-total-coins">0 ◆</span>
    </div>
    </div>
    <button class="payout-valued-btn" id="po-valued">Valued.</button>
    <button class="payout-ff-btn" id="po-ff" title="Fast forward">»</button>`;
  document.body.appendChild(el);

  // Tab switching: Payout (coin animation) vs Contributions (round breakdown)
  const viewPayout  = el.querySelector('#po-view-payout');
  const viewContrib = el.querySelector('#po-view-contrib');
  const tabPayout   = el.querySelector('#po-tab-payout-btn');
  const tabContrib  = el.querySelector('#po-tab-contrib-btn');
  tabPayout.onclick = () => {
    tabPayout.classList.add('active'); tabContrib.classList.remove('active');
    viewPayout.style.display = ''; viewContrib.style.display = 'none';
  };
  tabContrib.onclick = () => {
    tabContrib.classList.add('active'); tabPayout.classList.remove('active');
    viewContrib.style.display = ''; viewPayout.style.display = 'none';
  };

  await wait(50);
  el.classList.add('show');
  await wait(400);

  // Fast-forward state
  let fastForward = false;
  el.querySelector('#po-ff').onclick = () => {
    fastForward = true;
    el.querySelector('#po-ff').disabled = true;
  };

  function ffSleep(ms) { return fastForward ? Promise.resolve() : sleep(ms); }

  function tickCoin(id) {
    const c = el.querySelector(`#${id}`);
    c.classList.add('tick');
    setTimeout(() => c.classList.remove('tick'), 150);
  }

  async function animateCount(id, target, interval = 220) {
    const c = el.querySelector(`#${id}`);
    if (fastForward) {
      c.textContent = target;
      tickCoin(id);
      return;
    }
    let n = 0;
    while (n < target) {
      n++;
      c.textContent = n;
      tickCoin(id);
      sfxCoin();
      await wait(interval);
      if (fastForward) {
        c.textContent = target;
        return;
      }
    }
  }

  // ── 1. Interest ──
  el.querySelector('#po-line-interest').classList.add('show');
  await ffSleep(500);
  await animateCount('po-interest', interestCoins);
  coins += interestCoins;
  updateCoinsUI();
  await ffSleep(400);

  // ── 2. Efficiency — rapid clock countdown ──
  el.querySelector('#po-line-efficiency').classList.add('show');
  await ffSleep(600);
  const clockEl = el.querySelector('#po-clock');
  const effCoinsEl = el.querySelector('#po-efficiency');
  clockEl.classList.add('ticking');
  if (fastForward) {
    clockEl.textContent = formatTime(0);
    effCoinsEl.textContent = efficiencyCoins;
    tickCoin('po-efficiency');
  } else {
    const totalDuration = 2100;
    const tickMs = totalDuration / frozenRoundSeconds;
    let secsLeft = frozenRoundSeconds;
    let effEarned = 0;
    while (secsLeft > 0) {
      secsLeft--;
      clockEl.textContent = formatTime(secsLeft);
      if ((frozenRoundSeconds - secsLeft) % 10 === 0 && secsLeft < frozenRoundSeconds) {
        effEarned++;
        effCoinsEl.textContent = effEarned;
        tickCoin('po-efficiency');
        sfxCoin();
      }
      await wait(tickMs);
      if (fastForward) {
        clockEl.textContent = formatTime(0);
        effCoinsEl.textContent = efficiencyCoins;
        break;
      }
    }
  }
  clockEl.classList.remove('ticking');
  coins += efficiencyCoins;
  updateCoinsUI();
  await ffSleep(400);

  // ── 4. Divider + total ──
  el.querySelector('#po-divider').classList.add('show');
  await ffSleep(200);
  el.querySelector('#po-total').classList.add('show');
  el.querySelector('#po-total-coins').textContent = `${totalCoins} ◆`;
  await ffSleep(600);

  // ── 5. Valued button ──
  el.querySelector('#po-valued').classList.add('show');

  // Wait for tap
  await new Promise(res => {
    el.querySelector('#po-valued').addEventListener('click', res, { once: true });
  });

  // ── Crossfade out payout *content* but keep the dark background up for continuity ──
  // The bg stays visible until the Trick pick overlay (which has its own dark bg) takes over.
  el.querySelectorAll('.payout-line, .payout-divider, .payout-total, .payout-valued-btn, .payout-ff-btn, .payout-title, .payout-tabs, .po-view')
    .forEach(node => { node.style.transition = 'opacity 0.25s ease'; node.style.opacity = '0'; });
  await wait(280);
  // Remove just the content; the overlay's own dark bg fades away when next-goal-bg or trick-choice take over
  el.classList.remove('show');
  await wait(280);
  el.remove();
}

async function animateCoinFromClock() {
  const clockEl = document.getElementById('round-clock');
  const coinsEl = document.getElementById('coins-display');
  if (!clockEl || !coinsEl) return;
  const fromRect = clockEl.getBoundingClientRect();
  const toRect   = coinsEl.getBoundingClientRect();
  const coin = document.createElement('div');
  coin.textContent = '💰';
  coin.style.cssText = `position:fixed;left:${fromRect.left + fromRect.width/2}px;top:${fromRect.top + fromRect.height/2}px;
    font-size:18px;z-index:999;pointer-events:none;transition:none;`;
  document.body.appendChild(coin);
  await new Promise(res => setTimeout(res, 20));
  coin.style.transition = 'left 0.5s cubic-bezier(0.4,0,0.2,1), top 0.5s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease-in 0.4s';
  coin.style.left = (toRect.left + toRect.width/2) + 'px';
  coin.style.top  = (toRect.top  + toRect.height/2) + 'px';
  coin.style.opacity = '0';
  await new Promise(res => setTimeout(res, 600));
  coin.remove();
}

async function pulseAndRefillClock() {
  const clockEl = document.getElementById('round-clock');
  if (!clockEl) return;
  // Pulse current frozen value
  clockEl.style.transition = 'transform 0.15s ease-out, color 0.15s';
  clockEl.style.transform = 'scale(1.4)';
  clockEl.style.color = '#e8b84b';
  await new Promise(res => setTimeout(res, 200));
  clockEl.style.transform = '';
  clockEl.style.color = '';
  await new Promise(res => setTimeout(res, 100));
  // Animate clock counting back up to ROUND_DURATION
  const steps = 12;
  for (let i = 0; i <= steps; i++) {
    const val = Math.round(frozenRoundSeconds + (ROUND_DURATION - frozenRoundSeconds) * (i / steps));
    clockEl.textContent = val;
    await new Promise(res => setTimeout(res, 40));
  }
  // Final pulse at full
  clockEl.style.transform = 'scale(1.2)';
  clockEl.style.color = '#e8b84b';
  await new Promise(res => setTimeout(res, 150));
  clockEl.style.transform = '';
  clockEl.style.color = '';
  await new Promise(res => setTimeout(res, 200));
}

async function pulseElement(el, duration = 500) {
  if (!el) return;
  el.style.transition = `transform ${duration * 0.3}ms ease-out, color ${duration * 0.3}ms`;
  el.style.transform = 'scale(1.15)';
  el.style.color = '#e8b84b';
  await new Promise(res => setTimeout(res, duration * 0.4));
  el.style.transform = '';
  el.style.color = '';
  await new Promise(res => setTimeout(res, duration * 0.6));
}

async function showNextGoalFlash() {
  const el    = document.getElementById('next-goal-flash');
  const numEl = document.getElementById('next-goal-number');
  if (!el || !numEl) return;

  const bg = document.getElementById('next-goal-bg');
  bg.classList.add('show');
  await new Promise(res => setTimeout(res, 250));

  numEl.textContent = roundGoal.toLocaleString();
  el.classList.remove('show');
  el.style.cssText = '';
  void el.offsetWidth;
  el.classList.add('show');
  el.style.opacity = '1';

  // Hold 1.5s with goal visible, then 321 starts below it (goal stays)
  await new Promise(res => setTimeout(res, 1500));
}

async function show321Countdown() {
  const overlay = document.getElementById('countdown-321-overlay');
  const numEl   = document.getElementById('countdown-321-number');
  const bg      = document.getElementById('next-goal-bg');
  const goalEl  = document.getElementById('next-goal-flash');
  if (!overlay || !numEl) return;

  // ── Start cards falling in NOW — they land during/after countdown ──
  startNewRoundDealAnims();

  // ── Begin fading out dark bg so play area appears while numbers count ──
  if (bg) {
    bg.style.transition = 'opacity 1.4s ease';
    bg.classList.remove('show');
  }

  const PER_NUM  = 500;
  const TOTAL_MS = PER_NUM * 3;
  const startSecs   = roundSeconds;
  const refillStart = performance.now();
  let refillDone = false;

  function tickRefill() {
    if (refillDone) return;
    const elapsed  = performance.now() - refillStart;
    const progress = Math.min(elapsed / TOTAL_MS, 1);
    roundSeconds   = Math.round(startSecs + (limits.round_time.current - startSecs) * progress);
    updateClockUI();
    if (progress < 1) requestAnimationFrame(tickRefill);
    else refillDone = true;
  }
  requestAnimationFrame(tickRefill);

  sfxCountdown321();
  for (const n of ['3','2','1']) {
    numEl.textContent = n;
    numEl.style.animation = 'none';
    void numEl.offsetWidth;
    numEl.style.animation = `countdown-pop ${PER_NUM}ms ease forwards`;
    overlay.classList.add('show');
    await new Promise(res => setTimeout(res, PER_NUM));
  }

  refillDone   = true;
  // Keep the round-start value triggerLevelUp/startGame already computed (it includes
  // carry-over time, +15s buffs, etc.), but cap it at the penalized round-time limit so
  // permanent "-5s round cap" debuffs (roundPenaltySeconds) actually stick. Previously this
  // line force-reset to the full limit, silently wiping every time penalty.
  roundSeconds = Math.max(10, Math.min(roundSeconds, limits.round_time.current - roundPenaltySeconds));
  updateClockUI();
  overlay.classList.remove('show');

  // Clean up goal flash if still lingering
  if (goalEl) { goalEl.style.opacity = '0'; goalEl.classList.remove('show'); goalEl.style.cssText = ''; }
  // Reset bg transition for next interlude
  if (bg) bg.style.transition = 'opacity 0.35s ease';

  await new Promise(res => setTimeout(res, 200));
}

