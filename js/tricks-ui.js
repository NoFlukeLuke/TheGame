function pickTrickOptions(n) {
  const pool = [...TRICK_POOL];
  // Don't offer already acquired bonuses (except stackable ones)
  const stackableIds = ['rich_soil','rowcol_triple_pips','rowcol_mult','rowcol_retrigger','rowcol_perm_double'];
  const filtered = pool.filter(b => !acquiredTricks.some(a => a.id === b.id && !stackableIds.includes(b.id)));
  // This held a THREE-tier bag written before `epic` existed, so epic fell through
  // to weight 1 and carried the same per-entity odds as legendary. Main's shared
  // table (and Luck) now decide it; drawn one at a time so they stay distinct.
  const picked = [], seen = new Set();
  for (let g = 0; g < n * 12 && picked.length < n; g++) {
    const left = filtered.filter(b => !seen.has(b.id));
    if (!left.length) break;
    const p = pickTrickByRarity(left) || left[0];
    seen.add(p.id); picked.push(p);
  }
  return picked;
}

// Returns a live description with current accumulated values for scaling Tricks
// Owner rule: every Trick whose bonus can change always shows its CURRENT value
// in parentheses. Persistent/level/owned-based tricks always have a number.
// Round-scoped tricks (they scale with round time / round counters) can only be
// computed during a live round - in the shop or reward grid they show "(N/A)".
function trickLiveDesc(trick) {
  const base = trick.desc;
  try {
    const B = (typeof BAL !== 'undefined') ? BAL : {};
    const live = (typeof gameTimerPaused === 'undefined') ? true : !gameTimerPaused;
    const el   = Math.max(0, roundStartSeconds - roundSeconds);   // seconds elapsed this round
    const now      = (v) => `${base} (now ${v})`;                 // always-meaningful
    const roundNow = (v) => `${base} ${live ? `(now ${v})` : '(N/A)'}`; // round-scoped
    switch (trick.id) {
      case 'move_as_one': { const q = moveAsOneQualifying(); return `${base} (${q.keys.length ? 'keyword: ' + q.keys.join(', ') : 'no keyword shared by 3 yet'})`; }
      case 'feelin_lucky': return `${base} (ranks: ${(trick._luckyRanks || []).join(' ') || 'rolled when taken'} · ${feelinLuckyRerollsLeft(trick)} rerolls left)`;
      // ── permanent accumulators / level / owned-based (always a number) ──
      case 'fives_discard':  return now(`+${bonusMult_fives || 0} pips`);
      case 'nines_mult':     return now(`+${bonusMult_nines || 0} mult`);
      case 'tens_mult':      return now(`+${bonusMult_tens || 0} mult`);
      case 'relentless':     { const f = Math.round((spadesRelentless || 0) * BAL.relentless.mult_per_spade * 100) / 100; return now(`x${Math.max(1, f).toFixed(2)} per spade · ${spadesRelentless || 0} spades scored`); }
      case 'compound_mult':  return now(`+${(bonusMult_compound || 0).toFixed(1)} mult`);
      case 'acorns':         return now(`+${Math.floor(bonusFocus_acorns || 0)} Focus/hand · ${(bonusFocus_acorns || 0).toFixed(2)} stored`);
      case 'plan_ahead':     return now(`+${Math.max(1, Math.round((handsPlayedGame || 0) / Math.max(1, level)))} Focus every 3rd hand`);
      case 'more_better':    return now(`+${bonusMult_morebetter || 0} mult`);
      case 'wild_side':      return now(`+${(negativeTilesTakenRun || 0) * (B.wild_side?.mult_per ?? 3)} mult`);
      case 'wait_for_it':    return now(`${Math.round((negativeTilesTakenRun || 0) * (B.wait_for_it?.chance_per ?? 0.02) * 100)}% replay chance`);
      case 'feng_shui':      return now(`+${bonusPips_fengshui || 0} pips`);
      case 'sapling':        return now(`${level - 1} levels applied`);
      case 'summit':         return now(`level ${level}`);
      case 'rising_tide':    return now(`+${(level - 1) * B.rising_tide.mult_per} mult`);
      case 'hummingbird':    return now(`+${((pauseInstanceGame || 0) + (rewindInstanceGame || 0)) * (B.hummingbird?.mult_per_pause ?? 2)} mult`);
      case 'magician':       return now(`+${ownedSleightCount() * (B.magician?.mult_per_sleight ?? 3)} mult`);
      case 'scalper':        return now(`×${(1 + (B.scalper?.mult_mult_per_missing ?? 0.25) * sleightChargeInfo().missing).toFixed(2)} mult`);
      // ── capped Focus-limit growers (r340): current earned of max ──
      case 'quick_draw':     return now(`+${focusCapGains['quick_draw'] || 0} of ${B.quick_draw?.cap ?? 10} Focus limit`);
      case 'expanse':        return now(`+${focusCapGains['expanse'] || 0} of ${B.expanse?.cap ?? 10} Focus limit`);
      case 'little_guys':    return now(`+${focusCapGains['little_guys'] || 0} of ${B.little_guys?.cap ?? 15} Focus limit`);
      case 'first_play':     return roundNow(`next hand +${Math.max(0, (B.first_play?.focus ?? 5) - (handsPlayedRound || 0))} Focus`);
      // ── position-line accumulators (reset each round) ──
      case 'groove':         return roundNow(`+${Math.floor((markCount_groove || 0) / 2)} Focus/hand`);
      case 'overtime':       return roundNow(`rewinds ${Math.floor((markCount_overtime || 0) / 3)}s per hand`);
      case 'assembly_line':  return roundNow(`next mark card +${assemblyMarkCount || 0} mult`);
      // ── round-time / round-counter scaling (live round only) ──
      case 'swift':          return roundNow(`+${Math.floor(el / B.swift.interval_seconds) * B.swift.mult_per_interval} mult`);
      case 'sediment':       return roundNow(`+${Math.floor(el / B.sediment.interval_seconds) * B.sediment.pips_per_interval} pips`);
      case 'albatross':      return roundNow(`+${(pausedSecondsRound || 0) * B.albatross.pips_per_second} pips`);
      case 'kingfisher':     return roundNow(`+${Math.floor(((pausedSecondsRound || 0) + (rewoundSecondsRound || 0)) / B.kingfisher.interval_seconds) * B.kingfisher.mult_per_interval} mult`);
      case 'still_water': { const e = (lastSwapRoundSeconds !== null) ? Math.max(0, lastSwapRoundSeconds - roundSeconds) : el; return roundNow(`+${B.still_water.mult_per_interval * Math.floor(e / 10)} mult`); }
      case 'spade_flood':    return roundNow(`+${Math.floor(roundSeconds / B.spade_flood.time_div)} pips`);
      case 'sands_of_time':  return roundNow(`+${Math.floor(roundSeconds / sandsDivisor())} pips`);
      case 'discard_pips':   return roundNow(`+${(cardsDiscardedRound || 0) * B.discard_pips.mult_per} mult`);
      case 'landfill':       return roundNow(`+${((discardsUsedRound || 0) + (swapsUsedRound || 0)) * B.landfill.mult_per} mult per card`);
      case 'combo_score':    return roundNow(`+${(handTypesRound ? handTypesRound.size : 0) * B.combo_score.mult_per_type} mult`);
      default: return base;
    }
  } catch (e) { return base; }
}

function hideTrickTooltip() {
  const tip = document.getElementById('trick-tooltip');
  if (tip) tip.remove();
  if (_trickPin) { _trickPin = null; trickPinMark(); if (typeof trayLiftEnd === 'function') trayLiftEnd(); }
}

// ── Trick Tray: render chips for all tray Tricks ──
let _trickCountShown = 0;
// ── Trick slots are a HARD cap (r277) ───────────────────────────────────────
// The tray used to answer a full house with a modal: the new Trick arrived
// holding itself hostage and you chose what it replaced on the spot. That made
// the cap a screen that happened TO you. It is a refusal now - the offer bounces,
// the count says why, and you free a slot by SELLING from the tray, which is a
// decision you take when you want to rather than one you are ambushed with.
//
// refuseTrickCapacity() is the ONE way that is said, so the sound, the pulse and
// the wording cannot drift between the shop, the reward grid and a pick.
function trickTrayFull() {
  return trickTray.length >= trickCapacity();
}
// An offer that would ADD a Trick to the tray. An improve offer carries
// entity 'trick' to draw the owned Trick, but takes no slot.
function offerNeedsTrickSlot(p) {
  return !!p && p.entity === 'trick' && !p._improve && trickTrayFull();
}

function pulseTrickCount() {
  const el = document.getElementById('trick-tray-count');
  if (!el) return;
  // Restart the animation on a repeat refusal: removing the class and reading
  // offsetWidth forces the reflow that makes re-adding it play again. Without it
  // a second refusal in the same second is silent, which reads as ignored.
  el.classList.remove('tray-full-pulse');
  void el.offsetWidth;
  el.classList.add('tray-full-pulse');
  clearTimeout(pulseTrickCount._t);
  pulseTrickCount._t = setTimeout(() => el.classList.remove('tray-full-pulse'), 1500);
}

function refuseTrickCapacity() {
  // refuse() is the one place the sound is played (r378); this site keeps its
  // own toast because the count chip's pulse below is part of the same answer.
  pulseTrickCount();
  if (typeof portraitShowTricks === 'function') portraitShowTricks();   // portrait hides the tray behind a swap
  refuse(`Trick slots full (${trickTray.length}/${trickCapacity()}). Sell one first.`);
  return false;
}

function renderTrickTray() {
  pruneRowColBonuses();
  const list = document.getElementById('trick-tray-list');
  if (!list) return;
  // A lifted copy points at a chip this render is about to replace (r409). A
  // pinned one is handed to the new chip at the end instead (trickPinReanchor).
  if (!_trickPin && typeof trayLiftEnd === 'function') trayLiftEnd();
  // The tray has two faces (r329, js/queue-views.js): the Tricks below, or the
  // Sleight draw queue. The intercept always ensures the corner toggle exists;
  // in queue view it renders the queue and this function stands down - so every
  // caller repaints whichever face is showing.
  if (typeof trayQueueIntercept === 'function' && trayQueueIntercept()) { if (_trickPin) hideTrickTooltip(); return; }
  // A newly GAINED Trick should land somewhere visible. In portrait the Tricks
  // view shares the strip with Knacks and the preview, so flip to it when the
  // count grows. Tally updated BEFORE the flip: setPortraitPanelView re-enters
  // this function to re-measure the marquee (see js/portrait-panel.js).
  const _trickGrew = trickTray.length > _trickCountShown;
  _trickCountShown = trickTray.length;
  if (_trickGrew && typeof portraitShowTricks === 'function') portraitShowTricks();
  const countEl = document.getElementById('trick-tray-count');
  if (countEl) {
    countEl.textContent = `${trickTray.length}/${trickCapacity()}`;
    countEl.style.color = trickTray.length >= trickCapacity() ? 'var(--red)' : 'var(--gold-dim)';
  }
  list.innerHTML = '';
  if (trickTray.length === 0) {
    list.innerHTML = '';   // empty → faint TRICKS watermark shows through (r95)
    return;
  }
  // Reward-grid-style CRT/neon card tiles inside a scrolling marquee track (r113).
  const RARS = ['common','rare','epic','legendary'];
  const track = document.createElement('div');
  track.className = 'chip-marquee';
  trickTray.forEach(trick => {
    const chip = document.createElement('div');
    const rar = RARS.includes(trick.tier) ? trick.tier : 'common';
    // r182: the chip is now only a FRAME. Its contents are the shared entity tile
    // (js/entity-tile.js) - the exact markup the reward grid and the Mart use - so
    // a Trick looks the same in your tray as it did when you picked it up and as
    // it does on the shelf. Mirror keeps its aim arrow in place of the emoji.
    // A Trick switched off by a boss (Voidwright's halves, the Censor's 45s
    // suspension) is drained of colour and marked, so "which of mine is off right
    // now" is answered by looking at the tray rather than by remembering.
    const bossOff = (typeof isTrickDisabledByBoss === 'function') && isTrickDisabledByBoss(trick.id);
    chip.className = `trick-tray-chip trick-tier-${trick.tier} rar-${rar}${bossOff ? ' trick-off' : ''}`;
    chip.dataset.trickId = trick.id;
    const isMirror = trick.id === 'mirror';
    const dir = trick._tiltDir; // -1 left, +1 right, undefined = not aimed
    const tile = { entity: 'trick', id: trick.id, label: trick.name,
                   emoji: isMirror ? (dir === -1 ? '◀' : dir === 1 ? '▶' : '◆') : trickEmoji(trick) };
    // tip:false - the chip's own tap bubble (read + hold for sell/discard)
    // already covers this tile; the delegated data-et bubble would double it.
    chip.innerHTML = entityTileHTML(tile, rar, { tip: false }) + (bossOff ? `<div class="trick-off-mark">OFF</div>` : '');
    if (isMirror) {
      chip.classList.add('trick-mirror');
      chip.title = trick.name + ' - tap to aim left/right';
    }
    // Cooldown / disable / primed ring (js/cooldown.js). Painted here as well as
    // by the widget's own sweep so a freshly rebuilt tray shows the right state on
    // its first frame instead of flashing un-badged for up to 250ms.
    if (typeof cdPaint === 'function') cdPaint(chip, cdForTrick(trick.id));
    track.appendChild(chip);
  });
  list.appendChild(track);
  // Portrait fans the tiles over each other when they don't fit; landscape (and
  // the fallback) keeps the slow auto-scroll marquee. Doing both would fight:
  // the marquee duplicates the tiles, which the fan would then measure.
  if (typeof fanTrickTray === 'function' && fanTrickTray(list, track)) {
    // fanned - no marquee
  } else {
    applyChipMarquee(list, track);
  }
  // Hover and click for every tile (originals + marquee clones, which copy the
  // markup but not the listeners).
  list.querySelectorAll('.trick-tray-chip').forEach(chip => {
    const trick = trickTray.find(t => t.id === chip.dataset.trickId);
    if (trick) { attachTrickHover(chip, trick); attachTrickClick(chip, trick); }
  });
  // Names are word-atomic and shrink to fit - never broken across a letter (r182).
  fitEntityNames(list, '.trick-tray-chip .rwd-name', { maxLines: 2, minPx: 5 });
  if (typeof trayLiftBind === 'function') trayLiftBind(list);
  trickPinReanchor(list);
}

// Hover → show tooltip; a short grace on leave lets the pointer reach the
// tooltip (and its Sell button) before it hides.
let _trickHoverTimer = null;
function cancelTrickHoverHide() { if (_trickHoverTimer) { clearTimeout(_trickHoverTimer); _trickHoverTimer = null; } }
function scheduleTrickHoverHide() { cancelTrickHoverHide(); _trickHoverTimer = setTimeout(hideTrickTooltip, 160); }
function attachTrickHover(chip, trick) {
  chip.addEventListener('mouseenter', () => { if (_trickPin) return; cancelTrickHoverHide(); showTrickTrayTooltip(trick, chip); });
  chip.addEventListener('mouseleave', () => { if (!_trickPin) scheduleTrickHoverHide(); });
}

// ── PIN (r489) ───────────────────────────────────────────────────────────────
// Hover shows the bubble; a CLICK pins it. A pinned bubble stays put, hover on
// other Tricks leaves it alone, and on a mouse the lifted copy freezes. So the
// pointer can cross the tray to reach Sell. Closed by clicking the Trick again,
// the bubble's X, a click anywhere else, or Escape. Mirror's click still flips
// its aim, and pins.
let _trickPin = null;   // { id } of the pinned Trick, or null
function trickPinMark() {
  const tip = document.getElementById('trick-tooltip');
  if (tip) tip.classList.toggle('pinned', !!_trickPin);
  document.getElementById('trick-tray-area')?.classList.toggle('tt-pinned', !!_trickPin);
}
function attachTrickClick(chip, trick) {
  chip.addEventListener('click', e => {
    e.stopPropagation();
    if (trick.id === 'mirror') {
      trick._tiltDir = (trick._tiltDir === -1) ? 1 : -1;
      _trickPin = { id: trick.id };
      renderTrickTray();
      return;
    }
    if (_trickPin && _trickPin.id === trick.id) { hideTrickTooltip(); return; }
    if (_trickPin && typeof trayLiftEnd === 'function') trayLiftEnd();
    cancelTrickHoverHide();
    _trickPin = { id: trick.id };
    showTrickTrayTooltip(trick, chip);
    if (e.pointerType !== 'touch' && matchMedia('(hover: hover)').matches && typeof trayLiftAt === 'function') {
      if (chip.classList.contains('tray-lifted')) trayLiftFreeze(true);
      else { trayLiftAt(chip, e.clientX, e.clientY); trayLiftFreeze(true); }
    }
  });
}
// After a re-render: the pinned Trick's chip is new (or gone, once sold).
function trickPinReanchor(list) {
  if (!_trickPin) return;
  const trick = trickTray.find(t => t.id === _trickPin.id);
  const chip = trick && list.querySelector(`.trick-tray-chip[data-trick-id="${trick.id}"]`);
  if (!chip) { hideTrickTooltip(); return; }
  if (typeof trayLiftReanchor === 'function') trayLiftReanchor(chip);
  // Leave a bubble that is mid-confirm alone; rebuilding it would drop the question.
  if (document.querySelector('#trick-tooltip .tip-confirming')) return;
  showTrickTrayTooltip(trick, chip);
}
document.addEventListener('click', e => {
  if (!_trickPin) return;
  if (e.target.closest && e.target.closest('#trick-tooltip, #trick-tray-list .trick-tray-chip')) return;
  hideTrickTooltip();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && _trickPin) hideTrickTooltip(); });

// r279 - ONE GESTURE. A tap (or a hover on a mouse) opens the description WITH
// Sell on it. r182 had split that apart, so disposing of a Trick needed a
// press-and-hold nobody could guess at; the second beat that protects the
// player is a CONFIRM on the button itself (tipConfirmAction) rather than a
// hidden gesture in front of it.
//
// SELL IS THE ONLY DISPOSAL (owner's call, r279). Discarding a Trick paid
// nothing and did nothing selling does not, so it was a second button whose
// only distinction was being worse.
//
function showTrickTrayTooltip(trick, anchorEl, { actions = true } = {}) {
  document.getElementById('trick-tooltip')?.remove();   // not hideTrickTooltip: that unpins
  const tip = document.createElement('div');
  tip.id = 'trick-tooltip';
  tip.className = `trick-tooltip trick-tier-${trick.tier}` + (actions ? ' has-actions' : '');
  const liveDesc = trickLiveDesc(trick);
  const _sv = (typeof trickSellValue === 'function') ? trickSellValue(trick) : 0;
  // The + and its rail (r288). Definitions never open unasked, here or anywhere.
  tip.innerHTML = `<button class="tt-close" aria-label="Close">✕</button>${kwMoreHTML(liveDesc)}<div class="trick-tooltip-name">${trick.name}</div><div class="trick-tooltip-desc">${colorizeKeywords(withSuitHalo(liveDesc))}</div>${kwDefsHTML(liveDesc)}`
                + (actions
                    ? `<div class="trick-tooltip-actions"><button class="trick-tooltip-sell" id="trick-tooltip-sell-btn">Sell 💰${_sv}</button></div>`
                    : '');
  tip.style.cssText = 'position:fixed;opacity:0;z-index:300;';
  document.body.appendChild(tip);
  // Selling asks first. Cancel RE-SHOWS the bubble rather than restoring its
  // markup - see tipConfirmAction.
  const _row = () => tip.querySelector('.trick-tooltip-actions');
  const _reopen = () => showTrickTrayTooltip(trick, anchorEl, { actions });
  tip.querySelector('#trick-tooltip-sell-btn')?.addEventListener('click', e => {
    e.stopPropagation();
    const _fl = feelinLuckyRerollsLeft(trick);
    tipConfirmAction(_row(), {
      question: _fl ? `Reroll its ranks for 💰${feelinLuckyRerollCost()} (30% of your credits)? ${_fl} left, then it sells.` : `Sell for 💰${_sv}?`,
      confirmLabel: _fl ? 'Reroll' : 'Sell',
      onYes: () => sellTrick(trick), onCancel: _reopen,
    });
  });
  tip.querySelector('.tt-close')?.addEventListener('click', e => { e.stopPropagation(); hideTrickTooltip(); });
  // Opening the rail changes the bubble's height, so it has to be re-placed or
  // a tooltip opened near the bottom of the screen grows off it.
  wireKwMore(tip, tip, () => placeTipSmart(anchorEl, tip));
  // Keep the bubble open while the pointer is over it (so Sell is clickable).
  tip.addEventListener('mouseenter', cancelTrickHoverHide);
  tip.addEventListener('mouseleave', () => { if (!_trickPin) scheduleTrickHoverHide(); });
  void tip.offsetWidth;
  // Opens into whichever side of the chip has the most room (was hardcoded to
  // above, which put it off-screen for tray tiles near the top).
  placeTipSmart(anchorEl, tip);
  tip.style.opacity = '1';
  trickPinMark();
}

// The tray is always on and the hand-preview area is hidden inline (landscape
// CSS overrides that for the dance). The grid placement this used to switch
// between went in r414.
function syncTrickTrayUI() {
  const trayArea = document.getElementById('trick-tray-area');
  const previewArea = document.getElementById('hand-preview-area');
  if (trayArea) trayArea.style.display = 'flex';
  if (previewArea) previewArea.style.display = 'none';
  renderTrickTray();
}

// ── Feelin Lucky (r360) ──────────────────────────────────────────────────────
// Its five ranks are rolled when it is taken and live on the Trick itself (so
// they save with the tray). A sell attempt with rerolls left costs 30% of your
// credits and rerolls the ranks instead; the fourth attempt really sells.
function feelinLuckyRoll(t) {
  const pool = ACTIVE_RANKS.filter(r => !(typeof isWildRank === 'function' && isWildRank(r)));
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  t._luckyRanks = pool.slice(0, BAL.feelin_lucky.ranks);
}
function feelinLuckyRerollsLeft(t) {
  return (t && t.id === 'feelin_lucky') ? Math.max(0, BAL.feelin_lucky.rerolls - (t._luckySells || 0)) : 0;
}
function feelinLuckyRerollCost() { return Math.floor(coins * BAL.feelin_lucky.sell_cost_share); }
// Returns true when the sell was turned into a reroll (the Trick stays).
function feelinLuckyIntercept(t) {
  if (!feelinLuckyRerollsLeft(t)) return false;
  const cost = feelinLuckyRerollCost();
  coins = Math.max(0, coins - cost); updateCoinsUI();
  t._luckySells = (t._luckySells || 0) + 1;
  feelinLuckyRoll(t);
  showMessage(`🍀 Feelin Lucky rerolled: ${t._luckyRanks.join(' ')} (-💰${cost})`, 'var(--gold)');
  if (typeof renderTrickTray === 'function') renderTrickTray();
  return true;
}

function selectTrick(trick, fromTrickFlow = false) {
  clearInterval(levelupTimer);
  acquiredTricks.push(trick);

  // Positional bonuses get an axis+index at pick time - steered by the position knacks
  // (Surveyor/Leveler/Alignment/District). See assignPositionMark() in scoring.js.
  assignPositionMark(trick);
  if (trick.id === 'feelin_lucky' && !trick._luckyRanks) feelinLuckyRoll(trick);

  updateTrickList();
  const lvlOverlay = document.getElementById('levelup-overlay');
  if (lvlOverlay) lvlOverlay.classList.remove('show');

  if (fromTrickFlow) return; // the caller (injectTrickAfterReward) renders

  if (pendingLevelUps > 0) {
    // More levels queued - show next trick screen after a short pause
    pendingLevelUps--;
    setTimeout(() => drainLevelUpQueue(), 400);
  } else {
    // All done - resume round
    startRoundTimer();
    updateClockUI();
    render();
    // Spawn challenge card only on a real level-up pick, not a challenge reward pick
    if (!isChallengeTrickPick && level % 3 === 0) setTimeout(spawnChallengeCard, 500);
    isChallengeTrickPick = false;
  }
}

// ══════════════════════════════════════════════
// GAME END
// ══════════════════════════════════════════════
function updateActProgressUI() {
  // Keep the ACT/node/sigil blocks in step - every caller of this (boss start,
  // boss end, startGame, reward-grid advance, save restore) is exactly a moment
  // the progress block needs repainting.
  if (typeof updateRunProgressUI === 'function') updateRunProgressUI();
  const labelEl = document.getElementById('game-timer-label');
  const valEl   = document.getElementById('game-timer');
  if (!labelEl || !valEl) return;
  if (isActMode()) {
    labelEl.textContent = 'Progress';
    if (bossActive) {
      valEl.textContent  = `Q${actNumber} · BOSS`;
      valEl.style.color  = '#ff6b6b';
    } else {
      const _next = (typeof guidedNextStopLabel === 'function') ? guidedNextStopLabel() : '';
      valEl.textContent  = `Q${actNumber} · ${nodeInAct}/5` + (_next ? ` · ${_next}` : '');
      valEl.style.color  = '';
    }
  }
}

function onGameWin() {
  stopTimers();
  // A finished run unlocks the next mode, won or lost (js/progress-unlock.js).
  if (typeof markModeFinished === 'function') markModeFinished(ACTIVE_MODE && ACTIVE_MODE.id);
  if (typeof hideQuarterCard === 'function') hideQuarterCard();
  if (typeof retireSavedRunIfCurrent === 'function') retireSavedRunIfCurrent();  // the run is over; its save is stale
  if (typeof recordRunToHistory === 'function') recordRunToHistory('win');       // log it before the numbers are reset
  const overlay = document.getElementById('end-overlay');
  const title   = document.getElementById('end-title');
  title.textContent = 'VICTORY';
  title.className   = 'victory';

  // The full run report - quarter by quarter, then the run totals (js/quarter.js).
  // A won run has already closed every quarter through rolloverQuarter.
  document.getElementById('end-stats').innerHTML = runReportHTML();
  overlay.classList.add('show');
}

function onGameEnd(gameover) {
  stopTimers();
  // A finished run unlocks the next mode, won or lost (js/progress-unlock.js).
  if (typeof markModeFinished === 'function') markModeFinished(ACTIVE_MODE && ACTIVE_MODE.id);
  if (typeof hideQuarterCard === 'function') hideQuarterCard();
  if (typeof retireSavedRunIfCurrent === 'function') retireSavedRunIfCurrent();  // the run is over; its save is stale
  if (typeof recordRunToHistory === 'function') recordRunToHistory(gameover ? 'loss' : 'timeup');
  const overlay = document.getElementById('end-overlay');
  const title = document.getElementById('end-title');
  title.textContent = gameover ? 'GAME OVER' : "TIME'S UP";
  title.className = gameover ? 'gameover' : 'timeup';

  // The same report a win gets. A run that ended badly still deserves the account
  // of itself; the quarter it died in comes through as a partial row.
  document.getElementById('end-stats').innerHTML = runReportHTML();
  overlay.classList.add('show');
}

// ══════════════════════════════════════════════
// BUTTON EVENTS
// ══════════════════════════════════════════════
let _lastPlayClick = 0;
document.getElementById('btn-play').addEventListener('click', () => {
  // Debounce: mobile taps can fire the click twice ~150-200ms apart, and the second
  // call would abort the first hand's score animation. Ignore a 2nd press within 250ms.
  const _now = Date.now();
  if (_now - _lastPlayClick < 250) { dbgEvent('info', 'play double-click ignored'); return; }
  _lastPlayClick = _now;
  cancelAutoSubmit();
  playHand();
});
document.getElementById('btn-discard').addEventListener('click', () => {
  // Drag to play (r409): DISCARD with nothing selected arms (or disarms) the
  // next drag to discard. With a selection it discards as it always has.
  if (selected.length === 0 && typeof dragControlsLive === 'function' && dragControlsLive()) {
    setDragDiscardArmed(!dragDiscardArmed);
    showMessage(dragDiscardArmed ? 'Drag to discard' : 'Discard cancelled', 'var(--cream-dim)');
    return;
  }
  if (typeof ctlDiscardGate === 'function' && !ctlDiscardGate()) return;
  doDiscard();
});

// ══════════════════════════════════════════════


// ══════════════════════════════════════════════
// TRICK TRAY FAN  (r160)
// ══════════════════════════════════════════════
// The portrait tray is half a narrow strip, and its tiles are drawn at ~70% of
// the strip's height, so anything past three Tricks will not fit side by side.
// Rather than shrink them or scroll them out of sight, the tiles TUCK OVER each
// other like a held hand: each one covers part of the previous, the newest sits
// fully visible on the right, and the rarity edge of every earlier tile still
// shows. A row that fits is left exactly as it was.
//
// Returns true when it took charge of the layout (so the caller skips the
// marquee), false in landscape or when there is nothing to measure.
const FAN_MIN_STEP = 13;
const FAN_MAX_TILT = 55;        // deg, portrait tilt ceiling (r399)
const FAN_PERSP_SHRINK = 0.97;  // perspective narrows a receding tile a touch more than cos   // px of each tucked tile that must stay visible

function fanTrickTray(list, track) {
  if (!list || !track) return false;
  const stage = document.getElementById('stage');
  if (!stage) return false;
  // Landscape fans too since r237 (it used to marquee): tiles overlap just
  // enough to fit, each showing AT LEAST HALF of itself. Only past that floor
  // does the row scroll - sideways, with no scrollbar (css). Handled below,
  // after the shared measurements.
  const landscape = stage.classList.contains('landscape');

  const chips = [...track.querySelectorAll('.trick-tray-chip')];
  list.classList.remove('fanned');
  if (!chips.length) return false;

  // Measured, not assumed: the tile width comes from CSS (it changes with the
  // 70% sizing) and the room available depends on the live strip.
  //
  // BOTH measurements must be in the same units. The cabinet applies CSS `zoom`,
  // which getBoundingClientRect() reports scaled but offsetWidth/clientWidth do
  // not - mixing the two silently divides the step by the zoom factor.
  // offsetWidth/clientWidth are the layout-px pair, which is also the unit the
  // value is written back out in.
  const tile  = chips[0].offsetWidth || 47;
  const avail = list.clientWidth;
  chips.forEach((c, i) => c.style.setProperty('--fan-z', String(i + 1)));  // later tiles on top

  if (avail <= 0) return false;   // not laid out yet - leave it alone

  // r486: the zigzag tray (js/tray-zigzag.js) is torn down first; it comes
  // back below only when the row does not fit flat (r492, like the tilt).
  if (typeof zzTeardown === 'function') zzTeardown(list);

  const GAP = 4;
  const PAD = 3;          // rounding + the track's own box; without it the fan
                          // lands a few px wide and clips its leftmost tile
  const room = avail - PAD;
  const n = chips.length;

  if (landscape) {
    const LGAP = 5;
    if (n * tile + (n - 1) * LGAP <= room) {
      track.style.setProperty('--fan-gap', LGAP + 'px');   // fits: an ordinary row
      return true;
    }
    // Tuck until they fit, but never past half a tile hidden. Past that floor
    // the row keeps the 50% step and SCROLLS instead (overflow-x on the list,
    // scrollbar hidden) - scrolled to the end so the newest Trick starts visible.
    const minStep = Math.ceil(tile * 0.5);
    const step = Math.max(minStep, (room - tile) / (n - 1));
    track.style.setProperty('--fan-gap', (step - tile).toFixed(2) + 'px');
    list.classList.add('fanned');
    requestAnimationFrame(() => { list.scrollLeft = list.scrollWidth; });
    return true;
  }

  // ONE variable, and it is the gap between tiles - positive when they fit,
  // negative when they tuck. Writing the measured TILE width back into a var
  // that the tile's own `width` reads would be a feedback loop; this cannot be.
  chips.forEach(c => { c.style.removeProperty('--tilt'); c.style.marginRight = ''; });
  if (n * tile + (n - 1) * GAP <= room) {
    track.style.setProperty('--fan-gap', GAP + 'px');   // fits: an ordinary row
    return true;
  }
  // Doesn't fit: the zigzag, when that is the Settings choice.
  if (typeof trayZigzagOn === 'function' && trayZigzagOn()) {
    trayTiltStop();
    if (zigzagTrickTray(list, track, chips)) return true;
  }
  // Doesn't fit (r399): TILT first. Every tile but the newest turns its right
  // edge back (rotateY about its left edge, css `rotate: y`), which shortens its
  // on-screen width to about tile*cos(a) while its LAYOUT box stays full width -
  // so the step is computed from the projected width, not the box. Only past FAN_MAX_TILT does the row start to overlap,
  // and then by less than the old flat tuck, floored at FAN_MIN_STEP.
  // r429: EVERY tile tilts, the newest included (owner: a flat last tile made
  // the turns cycle read wrong). The row is right-aligned by LAYOUT box, and a
  // tilted tile's visible width is only `proj`, so the last tile gives back the
  // difference as a negative right margin or the row ends in an empty gap.
  const k = n - 1;
  const cosNeed = (room - k * GAP) / (n * tile);
  const cosA = Math.max(Math.cos(FAN_MAX_TILT * Math.PI / 180), Math.min(1, cosNeed));
  const deg = Math.acos(cosA) * 180 / Math.PI;
  const proj = tile * cosA * FAN_PERSP_SHRINK;
  const fitStep = (room - proj) / k;
  const step = Math.max(FAN_MIN_STEP, Math.min(proj + GAP, fitStep));
  chips.forEach(c => c.style.setProperty('--tilt', deg.toFixed(1) + 'deg'));
  chips[k].style.marginRight = (proj - tile).toFixed(2) + 'px';
  track.style.setProperty('--fan-gap', (step - tile).toFixed(2) + 'px');
  list.classList.add('fanned');
  // `proj` is an estimate of the perspective; close the remaining gap against the
  // real painted edge (rect is zoomed, so convert to design px).
  const lr = list.getBoundingClientRect(), z = lr.width / (list.clientWidth || 1);
  const padR = parseFloat(getComputedStyle(list).paddingRight) || 0;
  // The face transitions its rotate, so measure it with the transition off
  // (a freshly set --tilt would otherwise still read 0deg).
  const face = chips[k].querySelector('.reward-cell') || chips[k];
  const faces = chips.map(c => c.querySelector('.reward-cell')).filter(Boolean);
  faces.forEach(f => { f.style.transition = 'none'; });
  const short = (lr.right - padR * z - face.getBoundingClientRect().right) / z;
  void list.offsetWidth;
  faces.forEach(f => { f.style.transition = ''; });
  if (Math.abs(short) > 0.5) chips[k].style.marginRight = (proj - tile - short).toFixed(2) + 'px';
  if (deg > 0.5) trayTiltArm(list); else trayTiltStop();
  return true;
}

// ── THE TILT TAKES TURNS (r408) ─────────────────────────────────────────────
// Portrait only. A tilted row hides most of each tile's face, so the tiles take
// turns STRAIGHTENING: one turns flat and comes forward, holds, tilts back, and
// the next one does it. A finger sliding over the row takes over: the tile under
// it straightens and its tooltip opens, so thumbing along the row reads every
// Trick in turn. The cycle resumes a few seconds after the finger lifts.
const TRAY_TILT_HOLD = 1500;     // ms each tile spends flat
const TRAY_TILT_RESUME = 4000;   // ms after a scrub before the cycle restarts
let _trayTiltTimer = null, _trayTiltIdx = -1, _trayTiltHoldUntil = 0;
function trayTiltChips() {
  const list = document.getElementById('trick-tray-list');
  if (!list || !list.classList.contains('fanned')) return [];
  if (document.getElementById('stage')?.classList.contains('landscape')) return [];
  return [...list.querySelectorAll('.trick-tray-chip')];
}
function trayTiltFocus(i) {
  const chips = trayTiltChips();
  // r429: every tile is tilted, so one near the right edge, turned flat, would
  // run past the tray and be clipped. It slides left by the overhang for its turn.
  const list = document.getElementById('trick-tray-list');
  const lr = list ? list.getBoundingClientRect() : null;
  const z = lr && list.clientWidth ? lr.width / list.clientWidth : 1;
  chips.forEach((c, j) => {
    const on = j === i;
    let dx = 0;
    if (on && lr) {
      // offsetLeft, not a rect: the rect already carries this chip's own
      // translate and scale if it is being re-focused.
      const op = (c.offsetParent || list).getBoundingClientRect();
      const right = op.left + (c.offsetLeft + c.offsetWidth * 1.03) * z;
      dx = Math.max(0, (right - (lr.right - 2 * z)) / z);
    }
    c.style.translate = dx ? `${-dx.toFixed(1)}px 0` : '';
    c.classList.toggle('tilt-focus', on);
  });
  _trayTiltIdx = i;
  return chips[i] || null;
}
function trayTiltStop() {
  clearInterval(_trayTiltTimer); _trayTiltTimer = null;
  document.querySelectorAll('#trick-tray-list .tilt-focus').forEach(c => c.classList.remove('tilt-focus'));
}
function trayTiltArm(list) {
  if (!_trayTiltTimer) _trayTiltTimer = setInterval(() => {
    const chips = trayTiltChips();
    if (!chips.length) { trayTiltStop(); return; }
    if (Date.now() < _trayTiltHoldUntil) return;
    if (document.body.classList.contains('reduced-motion')) { trayTiltFocus(-1); return; }
    // Every tile takes a turn (r429: the newest is tilted too). A tile that is
    // flat goes back before the next one comes up (an empty beat between them).
    const tilted = chips.length;
    if (_trayTiltIdx >= 0) { trayTiltFocus(-1); _trayTiltNext = (_trayTiltNext + 1) % Math.max(1, tilted); return; }
    trayTiltFocus(_trayTiltNext % Math.max(1, tilted));
  }, TRAY_TILT_HOLD);
  if (list._tiltScrub) return;
  list._tiltScrub = true;
  let active = false, moved = false, shown = -1, x0 = 0;
  const hit = x => {
    const chips = trayTiltChips();
    let idx = -1;
    chips.forEach((c, j) => { if (c.getBoundingClientRect().left <= x) idx = j; });
    return idx < 0 && chips.length ? 0 : idx;
  };
  list.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' || !trayTiltChips().length) return;
    active = true; moved = false; shown = -1; x0 = e.clientX;
    _trayTiltHoldUntil = Date.now() + 1e9;
    trayTiltFocus(hit(e.clientX));
  });
  list.addEventListener('pointermove', e => {
    if (!active) return;
    if (Math.abs(e.clientX - x0) > 6) moved = true;
    if (!moved) return;
    const i = hit(e.clientX);
    if (i === shown) return;
    shown = i;
    const chip = trayTiltFocus(i);
    const trick = chip && trickTray.find(t => t.id === chip.dataset.trickId);
    if (trick) showTrickTrayTooltip(trick, chip);
  });
  const end = () => {
    if (!active) return;
    active = false;
    _trayTiltHoldUntil = Date.now() + TRAY_TILT_RESUME;
    // A scrub ends ON the tooltip it opened; the click that follows must not
    // toggle it shut again.
    if (moved) list._swallowClick = Date.now();
  };
  list.addEventListener('pointerup', end);
  list.addEventListener('pointercancel', end);
  list.addEventListener('click', e => {
    if (list._swallowClick && Date.now() - list._swallowClick < 400) { e.stopPropagation(); list._swallowClick = 0; }
  }, true);
}
let _trayTiltNext = 0;
