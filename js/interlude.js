// `opts.prize` ends on the PRIZE grid instead of the ordinary reward grid. That is
// the only thing a boss round's completion does differently (r213): before this a
// boss jumped straight to the prize grid with no fall, no payout and no banner, so
// the hardest round of the act was the only one in the game that paid no credits.
// Both endings set rewardGridContext = 'interlude', so closeRewardGrid's
// finishInterlude continuation - which is what advances the act at nodeInAct 5 -
// is reached identically either way.
async function startInterlude(opts) {
  opts = opts || {};
  interludeActive = true;

  // Duck gain was set up by goal-reach (set to 0.4). Reuse it; lazy-init if missing.
  const ctx = getAudioCtx();
  if (!sfxDuckGain) {
    sfxDuckGain = ctx.createGain();
    sfxDuckGain.gain.setValueAtTime(0.4, ctx.currentTime);
    sfxDuckGain.connect(ctx.destination);
  }

  // The Pick (r244) photographs the board HERE, above the fall - the fall
  // discards every card to playedPile and replaces gridData with nulls, so this
  // is the last moment the board exists to be picked from.
  if (typeof pickTakeSnapshot === 'function') pickTakeSnapshot();

  // ── Stage 1: skip Success flash - goalCelebration already showed SUCCESS + confetti ──
  // Cards fall out next.
  const gridEl = document.getElementById('grid');

  // ── Stage 5: cards fall out ──
  await showLevelUpScreen_fallOnly();

  // ── Payout + reward now happen ON the board (r101): the empty grid shows the
  // payout panel, then the reward tiles. The full dark veil is NOT raised here -
  // it comes back later for the deal-in (closeRewardGrid + showNextGoalFlash). ──
  await new Promise(res => setTimeout(res, 200));

  // ── Stage 4: payout panel, rendered into the empty grid ──
  await showPayoutUI();

  interludeActive = false;
  sfxDuckGain.disconnect();
  sfxDuckGain = null;

  // The Pick (r244): the board comes back and one card is operated on. AFTER the
  // payout (the round's accounting) and BEFORE any reward screen (the round's
  // spoils), which is the order those two already read in. Awaited, so every
  // route below - guided, map, the reward grid, the prize grid - resumes only
  // once the player has chosen or skipped.
  if (typeof runPayoutPick === 'function') await runPayoutPick();

  // Guided's elite pays out here, while the round's own counters are still live -
  // triggerLevelUp resets handsPlayedRound and handTypesRound, which is what every
  // challenge test reads (js/guided-mode.js).
  if (typeof guidedSettleChallenge === 'function') guidedSettleChallenge();

  // Guided (r218): the reward grid is something you BUY with a slot, not
  // something every round hands you, so the payout goes back to the crossroads.
  // The post-boss PRIZE grid is not a bought stop and still opens here.
  if (typeof guidedActive === 'function' && guidedActive() && !opts.prize) {
    guidedAfterSlot();
    return;
  }

  // Map mode (r238): a cleared level pays its pick-of-three (and a hard round's
  // knack pick) and goes back to the map. The post-boss PRIZE grid still opens
  // here - its close is what routes a map run to the win (js/reward-grid.js).
  if (typeof mapActive === 'function' && mapActive() && !opts.prize) {
    mapAfterLevel();
    return;
  }

  // ── Reward grid replaces Trick choice - player picks spoils, then new round setup runs ──
  rewardGridContext = 'interlude';
  // opts.prize is set by endBoss. With bosses switched off there is no endBoss to
  // set it, and node 5 is an ordinary round that closes the quarter - so it is
  // asked for here instead. Beating the quarter should pay the prize grid whether
  // or not a boss was standing in front of it.
  const prize = opts.prize || (typeof isActMode === 'function' && isActMode()
                && nodeInAct === 5 && typeof bossesEnabled === 'function' && !bossesEnabled());
  if (prize) openPrizeGrid(); else openRewardGrid();
}

async function showLevelUpScreen_fallOnly() {
  // Just the fall-out phase - every card (including Tricks) visually falls.
  // Tricks' positions are preserved in gridData so showLevelUpScreen can refill them in place.
  animating = true;
  selected = [];

  // ── Focus meter notch/dot fall (chunk 2 item 4) ──
  // Fire focus fall ~150ms BEFORE card fall so notches leave first (small stagger).
  // Collect lit dots and filled nodes, spawn fall clones, then zero focusNodes silently.
  const FOCUS_LEAD_MS = 150;
  // Trade Winds: cash out half the round's remaining Focus before it falls away.
  if (hasKnack('trade_winds') && focusNodes > 0) {
    const _payout = Math.floor(focusNodes * BAL.trade_winds.payout_fraction);
    if (_payout > 0) { coins += _payout; updateCoinsUI(); showMessage(`⛵ Trade Winds - +${_payout} credits`, 'var(--gold)'); }
  }
  if (focusNodes > 0) {
    const cap = focusCapNodes();
    const total = Math.min(focusNodes, cap);

    // Every filled node falls, highest first.
    const filledNodes = [];
    for (let i = total - 1; i >= 0; i--) {
      const n = focusNodeEls[i];
      if (n) filledNodes.push(n);
    }
    filledNodes.forEach((n, i) => spawnFocusFallClone(n, { delay: i * 20 }));

    // Zero state silently - the real DOM goes dark immediately while clones fall.
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
  // The marked-row / marked-column lines belong to the board that just went away
  // (js/entity-fx.js). They have to be dropped HERE rather than guarded inside
  // render(), because this teardown removes the card elements directly and no
  // render runs afterwards - so a guard would never get the chance to look. The
  // next round's first render draws them again from rowColBonuses, which is
  // untouched: the Tricks still own their lines.
  if (typeof clearLineMarkers === 'function') clearLineMarkers();

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
    showMessage('🗿 Idol - triple interest!', 'var(--gold)');
  }
  // Withheld (reward-grid penalty): this payout pays nothing. The breakdown is
  // still shown, with its figures zeroed, so the round is accounted for and the
  // player can see exactly what the penalty cost them - a payout screen that
  // simply did not appear would read as a bug.
  const _withheld = !!skipNextPayout;
  skipNextPayout = false;
  // Interest Freeze (reward-grid penalty): interest alone is suspended for a few
  // rounds - leftover-time credits still pay, so the round is still worth playing
  // well; what is frozen is the reward for HOLDING credits.
  const _frozen = interestFreezeRounds > 0;
  if (_frozen) interestFreezeRounds--;
  const interestCoins  = (_withheld || _frozen) ? 0 : interestPayout(coins, interestMult);
  // In Crunch the round clock IS the quarter's act bank, so paying for what is
  // left on it would pay for time the player has not finished spending (and pay
  // it again every level). The line becomes PAR instead: credits for every
  // efficiencySecondsPerCoin() seconds this round came in under CRUNCH_PAR_SECONDS.
  // Same rate, so Time and a Half still doubles it without knowing this mode exists.
  const efficiencyCoins = _withheld ? 0
    : (typeof crunchActive === 'function' && crunchActive())
      ? crunchParCredits()
      : Math.floor(frozenRoundSeconds / efficiencySecondsPerCoin());
  // Unspent (r218): swaps and discards you did NOT use pay out. Until this, a
  // round ended with leftover manipulates worth exactly nothing, so spending them
  // on anything at all was strictly better than holding them. Now holding is a
  // real alternative - the round's resources are a budget you can bank instead.
  // The LIVE swaps/discards, and that is not the obvious choice - it is worth
  // knowing why. This payout runs from startInterlude, which is reached from the
  // goal dance and happens BEFORE triggerLevelUp: the reward grid comes next, and
  // only when it closes does triggerLevelUp run and reset both to the new round's
  // values. So at this instant they still hold what the finished round had left.
  // (Survival is the mirror image and has to use frozenUnspentActions instead -
  // it skips this screen entirely and pays from inside triggerLevelUp, after the
  // reset. See survivalAfterLevelUp.)
  const unspentActions = Math.max(0, swaps) + Math.max(0, discards);
  const unspentCoins   = _withheld ? 0 : unspentPayout(unspentActions);
  const totalCoins     = interestCoins + efficiencyCoins + unspentCoins;
  // What this quarter's payouts paid, for the run report (js/quarter.js).
  if (typeof recordQuarterPayout === 'function') recordQuarterPayout(totalCoins);
  if (_withheld) showMessage('Payout withheld', 'var(--red)');
  else if (_frozen) showMessage(`Interest frozen (${interestFreezeRounds} more)`, 'var(--red)');
  // Show the Idol's tripled interest right on the payout breakdown.
  const interestName = interestMult > 1 ? `Interest <span style="color:#f5c042;">🗿 ×${interestMult}</span>` : 'Interest';
  const interestDesc = interestPayoutDesc(coins, interestMult,
    `<span style="color:#f5c042;">◆ ${coins}</span>`);

  // ── THE PAYOUT IS TILES ON THE BOARD (r255) ─────────────────────────────
  // It has rendered into #grid-slot since r101, but as ONE panel, which did not
  // read as being on the board at all. It is now a TITLE TILE and one tile per
  // section, each falling in like a card at the moment its line is revealed -
  // so the existing sequencing below drives the deal for free (every stage
  // already does `.classList.add('show')` on its line).
  //
  // The tiles are NOT card-sized: a payout line is a row of text, so the tiles
  // are board-width and the stack is measured against the board, not against
  // the cell grid the pick-of-three uses.
  //
  // EVERY ID IS UNCHANGED between the two layouts, which is what lets the whole
  // count-up / fast-forward machinery below stay untouched: po-interest,
  // po-clock, po-efficiency, po-unspent, po-total, po-total-coins, po-divider,
  // po-valued, po-ff, po-line-*, po-view-*, po-tab-*-btn.
  // PAYOUT_TILED = false falls back to the pre-r255 panel (payoutPanelHTML).
  const _poCtx = { interestName, interestDesc, unspentActions };
  const el = document.createElement('div');
  el.id = 'payout-overlay';
  el.innerHTML = PAYOUT_TILED ? payoutTiledHTML(_poCtx) : payoutPanelHTML(_poCtx);
  if (PAYOUT_TILED) {
    // The payout IS the board (r257). Take the grid over at the size this
    // screen wants and mount INTO #grid, so the tiles are placed in the same
    // cell units the cards are and nothing sits outside the grid's footprint.
    // Released at the Valued tap, below - runPayoutPick (r244) brings the real
    // board back immediately afterwards and must not inherit this one.
    const _g = gridScreenTakeover(PAYOUT_ROWS, PAYOUT_COLS);
    el.classList.add('in-grid', 'po-tiled');
    (_g || document.body).appendChild(el);
    payoutPlaceTiles(el);
  } else {
    // Pre-r255: one panel centred over the grid area (r101).
    const _slot = document.getElementById('grid-slot');
    if (_slot) { el.classList.add('in-grid'); _slot.appendChild(el); }
    else document.body.appendChild(el);
  }

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

  // How often the coin sound fires while a line counts up: every coin for a
  // small payout, every 3rd up to 18 coins, every 5th past that - and if even
  // 5s would exceed ~7 sounds, the stride widens so a payout never plays more
  // than 7 coin sounds. The count itself still goes up by 1; it just runs
  // stride-times faster (capped at 5x) so the line takes the same beat.
  function coinStride(target) {
    if (target <= 6)  return 1;
    if (target <= 18) return 3;
    return Math.max(5, Math.ceil(target / 7));
  }

  async function animateCount(id, target, interval = 220) {
    const c = el.querySelector(`#${id}`);
    if (fastForward) {
      c.textContent = target;
      tickCoin(id);
      return;
    }
    const stride = coinStride(target);
    const step = interval / Math.min(5, stride);
    let n = 0;
    while (n < target) {
      n++;
      c.textContent = n;
      if (n % stride === 0 || n === target) {
        tickCoin(id);
        sfxCoin();
      }
      await wait(step);
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

  // ── 2. Efficiency - rapid clock countdown ──
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
    // payoutClockSeconds() is what this line counts DOWN from: the leftover
    // round time, or in Crunch the seconds under par. One function so the
    // animation and the figure above can never disagree.
    const _poSecs = payoutClockSeconds();
    const totalDuration = 2100;
    const tickMs = totalDuration / Math.max(1, _poSecs);
    let secsLeft = _poSecs;
    let effEarned = 0;
    const effStride = coinStride(efficiencyCoins);
    while (secsLeft > 0) {
      secsLeft--;
      clockEl.textContent = formatTime(secsLeft);
      if ((_poSecs - secsLeft) % efficiencySecondsPerCoin() === 0 && secsLeft < _poSecs) {
        effEarned++;
        effCoinsEl.textContent = effEarned;
        if (effEarned % effStride === 0 || effEarned === efficiencyCoins) {
          tickCoin('po-efficiency');
          sfxCoin();
        }
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

  // ── 3. Unspent swaps and discards ──
  el.querySelector('#po-line-unspent').classList.add('show');
  await ffSleep(500);
  await animateCount('po-unspent', unspentCoins, 140);
  coins += unspentCoins;
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
  // On the tiled board the TILES are the content, so they are what fades.
  el.querySelectorAll(PAYOUT_TILED
      ? '.po-tile, .payout-ff-btn'
      : '.payout-line, .payout-divider, .payout-total, .payout-valued-btn, .payout-ff-btn, .payout-title, .payout-tabs, .po-view')
    .forEach(node => { node.style.transition = 'opacity 0.25s ease'; node.style.opacity = '0'; });
  await wait(280);
  // Remove just the content; the overlay's own dark bg fades away when next-goal-bg or trick-choice take over
  el.classList.remove('show');
  await wait(280);
  el.remove();
  // Hand the board back at the player's own size (r257). runPayoutPick brings
  // the real cards back immediately after this and must not inherit the
  // payout's board; every route on from here re-deals or re-lays for itself.
  if (PAYOUT_TILED && typeof gridScreenRelease === 'function') gridScreenRelease();
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

  // r236: THE BOARD IS HELD BACK FROM HERE, not from show321Countdown.
  //
  // triggerLevelUp has already repopulated gridData by the time this runs, and
  // `dealPhase` was not set until startNewRoundDealAnims - so any render() in
  // the ~1.75s this stamp is up (a Trick tap, a HUD sync, a resize) painted the
  // whole new board instantly behind it. The 3-2-1 then cleared those elements
  // and dealt the same cards again as a fall: the reported "it says NEXT QUOTA
  // while the cards fall in, then the countdown restarts the fall".
  //
  // Safe to set here and nowhere earlier because this function is ALWAYS
  // followed immediately by show321Countdown - all three callers (level-up.js,
  // match3.js, tricks-ui.js) are `showNextGoalFlash().then(() => show321Countdown())`
  // - and that is what clears the flag when the deal lands.
  dealPhase = true;
  document.getElementById('grid')?.querySelectorAll('[data-card-id]:not(.temp-anim)').forEach(e => e.remove());

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

// ── The round-start 3-2-1 is pausable (r209) ──
// Both countdowns used to wait on a bare setTimeout, i.e. wall-clock time that nothing
// could hold. Pressing PAUSE during the deal therefore did nothing at all: pauseGame
// also returns early while no round timer is running, so the count kept going and the
// round started underneath the pause menu.
// countdownWait resolves after `ms` of UNPAUSED time, so a pause genuinely stops the count.
let countdownActive = false;
let countdownPaused = false;
function countdownWait(ms) {
  return new Promise(res => {
    let left = ms, last = performance.now();
    (function step(now) {
      const dt = now - last; last = now;
      if (!countdownPaused) left -= dt;
      if (left <= 0) res(); else requestAnimationFrame(step);
    })(last);
  });
}
function beginCountdown() { countdownActive = true; countdownPaused = false; }
function endCountdown()   { countdownActive = false; countdownPaused = false; }

async function show321Countdown() {
  const overlay = document.getElementById('countdown-321-overlay');
  const numEl   = document.getElementById('countdown-321-number');
  const bg      = document.getElementById('next-goal-bg');
  const goalEl  = document.getElementById('next-goal-flash');
  if (!overlay || !numEl) return;

  // ── Start cards falling in NOW - they land during/after countdown ──
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

  let refillPausedMs = 0, refillPauseMark = 0;
  // In Crunch there is nothing to refill: the clock is the QUARTER's allowance
  // and it CARRIES into this round. The animation below winds roundSeconds from
  // its current value up to limits.round_time.current, which here is a wind DOWN
  // from 13:00 to 3:00 - it was destroying ten minutes on the first round of
  // every run, and doing it by writing the global rather than by reading it, so
  // the guard has to be on the animation and not on the value it leaves behind.
  const _crunchNoRefill = (typeof crunchActive === 'function' && crunchActive());
  function tickRefill() {
    if (refillDone) return;
    if (_crunchNoRefill) { refillDone = true; return; }
    // The clock refill is driven off wall time too, so it has to discount paused time
    // or the clock would fill while the count is held.
    if (countdownPaused) {
      if (!refillPauseMark) refillPauseMark = performance.now();
      requestAnimationFrame(tickRefill); return;
    }
    if (refillPauseMark) { refillPausedMs += performance.now() - refillPauseMark; refillPauseMark = 0; }
    const elapsed  = performance.now() - refillStart - refillPausedMs;
    const progress = Math.min(elapsed / TOTAL_MS, 1);
    roundSeconds   = Math.round(startSecs + (limits.round_time.current - startSecs) * progress);
    updateClockUI();
    if (progress < 1) requestAnimationFrame(tickRefill);
    else refillDone = true;
  }
  requestAnimationFrame(tickRefill);

  beginCountdown();
  sfxCountdown321();
  for (const n of ['3','2','1']) {
    numEl.textContent = n;
    numEl.style.animation = 'none';
    void numEl.offsetWidth;
    numEl.style.animation = `countdown-pop ${PER_NUM}ms ease forwards`;
    overlay.classList.add('show');
    await countdownWait(PER_NUM);
  }
  endCountdown();

  refillDone   = true;
  // Keep the round-start value triggerLevelUp/startGame already computed (it includes
  // carry-over time, +15s buffs, etc.), but cap it at the penalized round-time limit so
  // permanent "-5s round cap" debuffs (roundPenaltySeconds) actually stick. Previously this
  // line force-reset to the full limit, silently wiping every time penalty.
  // In Crunch the clock is the QUARTER's allowance, not a round's, and it opens
  // legitimately far above the round-time limit (13:00 against 3:00). Capping it
  // here cut it to the limit on the first round of every run and silently
  // destroyed ten minutes. The round-cap PENALTY still bites - it is damage the
  // player took - it just comes off the bank instead of off a limit.
  roundSeconds = (typeof crunchActive === 'function' && crunchActive())
    ? Math.max(10, roundSeconds - roundPenaltySeconds)
    : Math.max(10, Math.min(roundSeconds, limits.round_time.current - roundPenaltySeconds));
  updateClockUI();
  overlay.classList.remove('show');

  // Clean up goal flash if still lingering
  if (goalEl) { goalEl.style.opacity = '0'; goalEl.classList.remove('show'); goalEl.style.cssText = ''; }
  // Reset bg transition for next interlude
  if (bg) bg.style.transition = 'opacity 0.35s ease';

  await countdownWait(200);
}



// ══════════════════════════════════════════════════════════════════════════
// PAYOUT MARKUP - two layouts, ONE set of ids (r255)
//
// The animation code in showPayoutUI addresses everything by id and knows
// nothing about the layout, so the two builders below are interchangeable.
// Flip PAYOUT_TILED to go back to the pre-r255 panel.
// ══════════════════════════════════════════════════════════════════════════
const PAYOUT_TILED = true;

// THE PAYOUT IS THE BOARD (r257). Same shape as the pick-of-three: the grid is
// taken over at the size this screen wants and every tile is placed in CELL
// UNITS, so the payout is made of the same furniture as every other board
// screen rather than being a column of boxes floated over one.
//
// A PAYOUT_COLS x PAYOUT_ROWS board, and it closes exactly:
//
//     row 0   : the title tile, full width
//     row 1   : the two tabs, 3 cells each
//     rows 2-4: the payout's three lines (one row each), OR, on the
//               Contributions tab, one tall tile spanning all three
//     row 5   : Total (3 cells) and the Valued button (3 cells)
//
// TOTAL IS DELIBERATELY OUTSIDE #po-view-payout. It used to live inside it, so
// switching to Contributions left row 5's left half empty - and an empty cell
// is exactly what a board screen may not have. It is also true on both tabs.
const PAYOUT_COLS = 6, PAYOUT_ROWS = 6;

// `data-box` is "row,col,width,height" in cells; payoutPlaceTiles turns each
// into a real box once the board has been re-laid (the metrics are not known
// until then). Declarative here, measured there.
function payoutTiledHTML(c) {
  return `
    <div class="po-tile po-tile-title show" data-box="0,0,6,1">
      <div class="payout-title">Payout</div>
    </div>
    <div class="po-tile po-tile-tab show" data-box="1,0,3,1">
      <button class="payout-tab active" id="po-tab-payout-btn">Payout</button>
    </div>
    <div class="po-tile po-tile-tab show" data-box="1,3,3,1">
      <button class="payout-tab" id="po-tab-contrib-btn">Contributions</button>
    </div>
    <div id="po-view-contrib" class="po-view" style="display:none">
      <div class="po-tile po-tile-contrib show" data-box="2,0,6,3">
        <div class="contrib-head">This round · ${roundHandsScored} hand${roundHandsScored === 1 ? '' : 's'} scored</div>
        <div class="contrib-scroll">${roundContributionRowsHTML()}</div>
      </div>
    </div>
    <div id="po-view-payout" class="po-view">
      <div class="po-tile payout-line" id="po-line-interest" data-box="2,0,6,1">
        <div class="pl-left">
          <div class="pl-name">${c.interestName}</div>
          <div class="pl-desc">${c.interestDesc}</div>
        </div>
        <div class="pl-right">
          <span class="pl-coins" id="po-interest">0</span>
          <span class="pl-sym">◆</span>
        </div>
      </div>
      <div class="po-tile payout-line" id="po-line-efficiency" data-box="3,0,6,1">
        <div class="pl-left">
          <div class="pl-name">${payoutEfficiencyName()}</div>
          <div class="pl-desc">${payoutEfficiencyDesc()}</div>
        </div>
        <div class="pl-right">
          <span class="pl-clock" id="po-clock">${formatTime(payoutClockSeconds())}</span>
          <span class="pl-coins" id="po-efficiency">0</span>
          <span class="pl-sym">◆</span>
        </div>
      </div>
      <div class="po-tile payout-line" id="po-line-unspent" data-box="4,0,6,1">
        <div class="pl-left">
          <div class="pl-name">Unspent</div>
          <div class="pl-desc">${unspentPayoutDesc()} · ${c.unspentActions} left</div>
        </div>
        <div class="pl-right">
          <span class="pl-coins" id="po-unspent">0</span>
          <span class="pl-sym">◆</span>
        </div>
      </div>
    </div>
    <!-- The divider has no job on a board of tiles (the tiles ARE the
         separation), but the stage sequencing still calls .show on it, so it
         stays in the DOM and is hidden by css/payout-grid.css. -->
    <div class="payout-divider" id="po-divider"></div>
    <div class="po-tile payout-total" id="po-total" data-box="5,0,3,1">
      <span class="pt-label">Total</span>
      <span class="pt-coins" id="po-total-coins">0 ◆</span>
    </div>
    <button class="payout-valued-btn po-tile" id="po-valued" data-box="5,3,3,1">Valued.</button>
    <button class="payout-ff-btn" id="po-ff" title="Fast forward">»</button>`;
}

// Turn every data-box into a real box, in the same cell units the cards use
// (gpBox, js/grid-pick.js). Called after the board has been taken over, and
// again on a re-lay.
function payoutPlaceTiles(el) {
  if (typeof gpBox !== 'function') return;
  el.querySelectorAll('[data-box]').forEach(t => {
    const [r, c, w, h] = t.dataset.box.split(',').map(Number);
    t.style.cssText += gpBox(r, c, w, h);
  });
}

// PRE-r255 PANEL, kept whole for revert (PAYOUT_TILED = false). One centred
// panel over the board rather than tiles on it.
function payoutPanelHTML(c) {
  return `
    <div class="payout-title">Payout</div>
    <div class="payout-tabs">
      <button class="payout-tab active" id="po-tab-payout-btn">Payout</button>
      <button class="payout-tab" id="po-tab-contrib-btn">Contributions</button>
    </div>
    <div id="po-view-contrib" class="po-view" style="display:none">
      <div class="contrib-head">This round · ${roundHandsScored} hand${roundHandsScored === 1 ? '' : 's'} scored</div>
      <div class="contrib-scroll">${roundContributionRowsHTML()}</div>
    </div>
    <div id="po-view-payout" class="po-view">
    <div class="payout-lines">
      <div class="payout-line" id="po-line-interest">
        <div class="pl-left">
          <div class="pl-name">${c.interestName}</div>
          <div class="pl-desc">${c.interestDesc}</div>
        </div>
        <div class="pl-right">
          <span class="pl-coins" id="po-interest">0</span>
          <span class="pl-sym">◆</span>
        </div>
      </div>
      <div class="payout-line" id="po-line-efficiency">
        <div class="pl-left">
          <div class="pl-name">${payoutEfficiencyName()}</div>
          <div class="pl-desc">${payoutEfficiencyDesc()}</div>
        </div>
        <div class="pl-right">
          <span class="pl-clock" id="po-clock">${formatTime(payoutClockSeconds())}</span>
          <span class="pl-coins" id="po-efficiency">0</span>
          <span class="pl-sym">◆</span>
        </div>
      </div>
      <div class="payout-line" id="po-line-unspent">
        <div class="pl-left">
          <div class="pl-name">Unspent</div>
          <div class="pl-desc">${unspentPayoutDesc()} · ${c.unspentActions} left</div>
        </div>
        <div class="pl-right">
          <span class="pl-coins" id="po-unspent">0</span>
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
}
