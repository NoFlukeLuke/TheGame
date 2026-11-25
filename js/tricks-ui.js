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
    const el   = clockElapsed();   // seconds elapsed this round
    // r846 (owner): the current amount leads the sentence.
    const now      = (v) => `(now ${v}) ${base}`;                 // always-meaningful
    const roundNow = (v) => `${live ? `(now ${v})` : '(N/A)'} ${base}`; // round-scoped
    switch (trick.id) {
      case 'move_as_one': { const q = moveAsOneQualifying(); return `(${q.keys.length ? 'keyword: ' + q.keys.join(', ') : 'no keyword shared by 3 yet'}) ${base}`; }
      case 'feelin_lucky': return `(ranks: ${(trick._luckyRanks || []).join(' ') || 'rolled when taken'} · ${trick._luckyFixed ? 'fixed' : feelinLuckyRerollsLeft(trick) + ' rerolls left'}) ${base}`;
      // ── permanent accumulators / level / owned-based (always a number) ──
      case 'fives_discard':  return now(`+${bonusMult_fives || 0} pips`);
      case 'nines_mult':     return now(`+${bonusMult_nines || 0} mult`);
      case 'tens_mult':      return now(`+${bonusMult_tens || 0} mult`);
      case 'relentless':     { const f = Math.round((relentlessBonus || 0) * 100) / 100; return now(`x${Math.max(1, f).toFixed(2)} per spade · next spade adds ${relentlessStepNow().toFixed(2)}`); }
      case 'compound_mult':  return now(`+${(bonusMult_compound || 0).toFixed(1)} mult`);
      case 'acorns':         return now(`+${Math.floor(bonusFocus_acorns || 0)} Focus/hand · ${(bonusFocus_acorns || 0).toFixed(2)} stored`);
      case 'plan_ahead':     return now(`+${(B.plan_ahead?.times ?? 2) * Math.max(1, Math.round((handsPlayedGame || 0) / Math.max(1, level)))} Focus every 3rd hand`);
      case 'patience_reward': return roundNow(`+${typeof heronMult === 'function' ? heronMult() : 0} mult`);
      case 'more_better':    return now(`+${bonusMult_morebetter || 0} mult`);
      case 'wild_side':      return now(`+${(negativeTilesTakenRun || 0) * (B.wild_side?.mult_per ?? 3)} mult`);
      case 'wait_for_it':    return now(`${Math.round((negativeTilesTakenRun || 0) * (B.wait_for_it?.chance_per ?? 0.02) * 100)}% replay chance`);
      case 'feng_shui':      return now(`+${bonusPips_fengshui || 0} pips`);
      case 'sapling':        return now(`${level - 1} levels applied`);
      case 'summit':         return now(`level ${level}`);
      case 'rising_tide':    return now(`+${risingTideMult || 0} mult${TB('rising_tide').xpips ? `, x${runQuarterNow()} pips` : ''}`);
      case 'employee_month': return roundNow(`hand ${eotmSync().n + 1} of the row: Focus ${1 + eotmFocusExtra()}x`);   // r802
      case 'middle_man':     return now(`+${middleManMult || 0} mult`);
      // r805 (owner): every scaling Trick says what it is worth now.
      case 'wellspring':     return now(`+${Math.floor((focusGenGame || 0) / (B.wellspring?.per_focus ?? 30)) * (B.wellspring?.mult_per ?? 1)} mult · ${Math.floor(focusGenGame || 0)} Focus made`);
      case 'expense_account': return now(`+${typeof expenseAccountMult === 'function' ? expenseAccountMult() : 0} mult`);
      case 'fire_sale':      return now(`+${Math.round((fireSaleMult || 0) * 100) / 100} mult`);
      case 'four_oh_one':    { const f = typeof fourOhOneFactors === 'function' ? fourOhOneFactors() : { m: 1, p: 1 }; return now(`x${f.p.toFixed(1)} pips · x${f.m.toFixed(1)} mult`); }
      case 'to_the_clouds':  return now(`+${(bonusMult_tens || 0) + (bonusMult_nines || 0)} mult`);
      case 'heartwood':      return now(`+${B.heartwood?.pips ?? 0} pips, +${B.heartwood?.mult ?? 0} mult a hand to its cell${(B.heartwood?.cells || 1) > 1 ? 's' : ''}`);
      case 'first_fruits':   return roundNow(`${Math.max(0, (B.first_fruits?.hands ?? 1) - (handsPlayedRound || 0))} hand${Math.max(0, (B.first_fruits?.hands ?? 1) - (handsPlayedRound || 0)) === 1 ? '' : 's'} left this level`);
      case 'hummingbird':    return now(`+${((pauseInstanceGame || 0) + (rewindInstanceGame || 0)) * (B.hummingbird?.mult_per_pause ?? 2)} mult`);
      case 'magician':       return now(magicianNoSleights() ? `+${B.magician?.solo_pips ?? 50} pips, no Sleights` : `+${ownedSleightCount() * (B.magician?.mult_per_sleight ?? 3)} mult`);
      case 'scalper':        return now(`×${(1 + (B.scalper?.mult_mult_per_missing ?? 0.25) * sleightChargeInfo().missing).toFixed(2)} mult`);
      // ── capped Focus-limit growers (r340): current earned of max ──
      case 'quick_draw':     return now(`+${focusCapGains['quick_draw'] || 0} of ${B.quick_draw?.cap ?? 10} Focus limit`);
      case 'expanse':        return now(`+${focusCapGains['expanse'] || 0} of ${B.expanse?.cap ?? 10} Focus limit`);
      case 'little_guys':    return now(`+${focusCapGains['little_guys'] || 0} of ${B.little_guys?.cap ?? 15} Focus limit`);
      case 'first_play':     return roundNow(`next hand +${Math.max(0, (B.first_play?.focus ?? 5) - (handsPlayedRound || 0))} Focus`);
      // ── position-line accumulators (reset each round) ──
      case 'groove':         return roundNow(`+${Math.floor((markCount_groove || 0) / 2)} Focus/hand`);
      case 'overtime':       return roundNow(`${markCount_overtime || 0} scored from its line · rewinds ${Math.floor((markCount_overtime || 0) / 5) * (B.overtime?.seconds_per_5 ?? 1)}s a hand`);
      case 'assembly_line':  return now(`+${typeof asmLinePerCard === 'function' ? asmLinePerCard() : 0} mult per line card · ${asmLine.cur} played from the line so far`);
      case 'coin_sword':     return now(`a hit adds +${typeof coinSwordMult === 'function' ? coinSwordMult() : 0} mult`);
      // ── round-time / round-counter scaling (live round only) ──
      case 'swift':          return roundNow(`+${Math.floor(el / B.swift.interval_seconds) * B.swift.mult_per_interval} mult`);
      case 'sediment':       return roundNow(`+${Math.floor(el / B.sediment.interval_seconds) * B.sediment.pips_per_interval} pips`);
      case 'albatross':      return roundNow(`+${(pausedSecondsRound || 0) * B.albatross.pips_per_second} pips`);
      case 'kingfisher':     return roundNow(`+${Math.floor(((pausedSecondsRound || 0) + (rewoundSecondsRound || 0)) / B.kingfisher.interval_seconds) * B.kingfisher.mult_per_interval} mult`);
      case 'still_water': { const e = (lastSwapRoundSeconds !== null) ? Math.max(0, lastSwapRoundSeconds - roundSeconds) : el; return roundNow(`+${B.still_water.mult_per_interval * Math.floor(e / B.still_water.interval_seconds)} mult`); }
      case 'spade_flood':    return roundNow(`+${Math.floor(clockLeftSecs() / B.spade_flood.time_div * (B.spade_flood.time_mult || 1))} pips`);
      case 'sands_of_time':  return roundNow(`+${Math.floor(roundSeconds / sandsDivisor())} pips`);
      case 'discard_pips':   return roundNow(`+${(cardsDiscardedRound || 0) * ((typeof flowActive === 'function' && flowActive()) ? B.discard_pips.mult_per_flow : B.discard_pips.mult_per)} mult`);
      case 'landfill':       return now(`+${typeof landfillCount === 'function' ? landfillCount() * B.landfill.mult_per : 0} mult`);
      case 'working_class':  return now(`+${typeof landfillCount === 'function' ? Math.ceil(landfillCount() * (B.working_class?.mult_per ?? 4) + (typeof fusedCarry === 'function' ? fusedCarry('landfill', 'mult') : 0)) : 0} mult from swaps and discards`);
      case 'penny_perfect':  { const p = typeof pennyPerfectBonus === 'function' ? pennyPerfectBonus() : { pips: 0, mult: 0 }; return now(`+${p.pips} pips, +${p.mult} mult`); }
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
// r646: the full tray for ONE Trick. The second half of an INSEPARABLE pair
// (js/inseparable.js) always fits: the fusion frees a slot.
function trickTrayFullFor(id) {
  return trickTrayFull() && !(typeof inseparableCompletes === 'function' && inseparableCompletes(id));
}
// An offer that would ADD a Trick to the tray. An improve offer carries
// entity 'trick' to draw the owned Trick, but takes no slot.
function offerNeedsTrickSlot(p) {
  return !!p && p.entity === 'trick' && !p._improve && trickTrayFullFor(p.id || (p._trick && p._trick.id) || (p.data && p.data.id));
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

// The count flashes gold when a slot is added (r527, reward grid).
function pulseTrickSlotGain() {
  if (typeof portraitShowTricks === 'function') portraitShowTricks();
  const el = document.getElementById('trick-tray-count');
  if (!el) return;
  el.classList.remove('tray-full-pulse', 'tray-slot-gain');
  void el.offsetWidth;
  el.classList.add('tray-slot-gain');
  if (typeof sfxRewardSelect === 'function') { try { sfxRewardSelect(); } catch (e) {} }
  clearTimeout(pulseTrickSlotGain._t);
  pulseTrickSlotGain._t = setTimeout(() => el.classList.remove('tray-slot-gain'), 1200);
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
  if (typeof chgTrickGone === 'function') chgTrickGone();   // r676: Temp sold or lost: its form's borrowed tier goes
  if (typeof rkPrune === 'function') rkPrune();   // r698: an Editor choice leaves with its entity
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
    chip.className = `trick-tray-chip trick-tier-${trick.tier} rar-${rar}${bossOff ? ' trick-off' : ''}${trick.fused ? ' fused' : ''}`;
    chip.dataset.trickId = trick.id;
    const isMirror = trick.id === 'mirror';
    const dir = trick._tiltDir; // -1 left, +1 right, undefined = not aimed
    const tile = { entity: 'trick', id: trick.id, label: trick.name,
                   emoji: isMirror ? (dir === -1 ? '◀' : dir === 1 ? '▶' : '◆') : trickEmoji(trick) };
    // tip:false - the chip's own tap bubble (read + hold for sell/discard)
    // already covers this tile; the delegated data-et bubble would double it.
    chip.innerHTML = entityTileHTML(tile, rar, { tip: false }) + (trick.id === 'changeling' && trick._form ? `<div class="chg-badge">${emGlyph('🦎')}</div>` : '') + (bossOff ? `<div class="trick-off-mark">${typeof altarTrickLocked === 'function' && altarTrickLocked(trick.id) ? 'LOCKED' : 'OFF'}</div>` : '');
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
  tip.innerHTML = `<button class="tt-close" aria-label="Close">✕</button>${kwMoreHTML(liveDesc, '', trick.id)}<div class="trick-tooltip-name">${trick.name}</div>${nameSayHTML(trick.name)}<div class="trick-tooltip-desc">${colorizeKeywords(withSuitHalo(liveDesc))}</div>${kwDefsHTML(liveDesc)}${upDefsShell(trick.id)}`
                + (actions
                    ? `<div class="trick-tooltip-actions"><button class="trick-tooltip-sell" id="trick-tooltip-sell-btn">Sell ${creditsTxt(_sv)}</button></div>`
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
      question: _fl ? `Reroll its ranks for ${creditsTxt(feelinLuckyRerollCost())} (30% of your credits)? ${_fl} left, then it sells.` : `Sell for ${creditsTxt(_sv)}?`,
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
  if (t && t._luckyFixed) return 0;   // r698: ranks fixed at the Editor, no more rerolls
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
  showMessage(`🍀 Feelin Lucky rerolled: ${t._luckyRanks.join(' ')} (-${creditsTxt(cost)})`, 'var(--gold)');
  if (typeof renderTrickTray === 'function') renderTrickTray();
  return true;
}

function selectTrick(trick, fromTrickFlow = false) {
  clearInterval(levelupTimer);
  acquiredTricks.push(trick);
  if (trick.id === 'changeling' && typeof changelingPickup === 'function') trick = changelingPickup(trick);   // r676: its own copy, changed at once mid-round

  // Positional bonuses get an axis+index at pick time - steered by the position knacks
  // (Surveyor/Leveler/Alignment/District). See assignPositionMark() in scoring.js.
  assignPositionMark(trick);
  if (trick.id === 'feelin_lucky' && !trick._luckyRanks) feelinLuckyRoll(trick);
  rkOnPickup(trick);                                     // r698: a fused Trick takes its part's Editor ranks
  if (trick.id === 'nines_mult') cloudNinePickup();      // r539: brings its own 9s
  if (trick.id === 'rising_tide') { risingTideMult = 0; }    // r539: counts from the pick
  if (trick.id === 'assembly_line') asmLine = { prev: null, cur: 0 };   // r646: counts from the pick; this round stands in until one ends
  if (trick.id === 'middle_man') middleManMult = 0;      // r649: likewise
  if (trick.id === 'fire_sale') fireSaleMult = 0;        // r722: counts from the pick
  if (trick.id === 'four_oh_one') { trick._k401m = 0; trick._k401p = 0; }   // r722: sales count from the pick
  if (typeof deluxeTake === 'function') deluxeTake(trick.id);   // Deluxe Subscription: arrives at the tier its offer showed

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
  if (typeof protocolOnWin === 'function') protocolOnWin();                      // r748: the protocol's Knack; r749: the next protocol (before the tier, so it can tell what is new)
  if (typeof difficultyOnWin === 'function') difficultyOnWin();                  // r728: the next difficulty tier opens for this mode
  if (typeof recordRunToHistory === 'function') recordRunToHistory('win');       // log it before the numbers are reset
  if (typeof unlockRunEnded === 'function') unlockRunEnded(true);                   // r706: runs / wins (js/unlocks.js)
  // r634: the finale (js/finale.js) over the board; the old #end-overlay is its fallback.
  showFinale('win');
}

function onGameEnd(gameover) {
  stopTimers();
  // A finished run unlocks the next mode, won or lost (js/progress-unlock.js).
  if (typeof markModeFinished === 'function') markModeFinished(ACTIVE_MODE && ACTIVE_MODE.id);
  if (typeof hideQuarterCard === 'function') hideQuarterCard();
  if (typeof retireSavedRunIfCurrent === 'function') retireSavedRunIfCurrent();  // the run is over; its save is stale
  if (typeof recordRunToHistory === 'function') recordRunToHistory(gameover ? 'loss' : 'timeup');
  if (typeof unlockRunEnded === 'function') unlockRunEnded(false);
  showFinale(gameover ? 'loss' : 'timeup');
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
let _lastDiscardArm = 0, _lastDiscardRun = 0;
document.getElementById('btn-discard').addEventListener('click', () => {
  // Drag to play (r409): DISCARD with nothing selected arms (or disarms) the
  // next drag to discard. With a selection it discards as it always has.
  if (selected.length === 0 && typeof dragControlsLive === 'function' && dragControlsLive()) {
    // r717: a phone can fire one tap's click twice ~150-200ms apart (PLAY has the
    // same guard); the second toggled the arm straight back off.
    // r805 (owner): a second press right after a discard RAN is the same tap too. The
    // selection was already gone, so it used to arm the next drag and discard the next
    // hand as well. One quick double tap is one discard, before or after selecting.
    const _now = Date.now();
    if (_now - _lastDiscardArm < 400 || _now - _lastDiscardRun < 500) return;
    _lastDiscardArm = _now;
    setDragDiscardArmed(!dragDiscardArmed);
    showMessage(dragDiscardArmed ? 'Drag to discard' : 'Discard cancelled', 'var(--cream-dim)');
    return;
  }
  if (typeof ctlDiscardGate === 'function' && !ctlDiscardGate()) return;
  _lastDiscardRun = Date.now();
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

  const GAP = 4;
  const PAD = 3;          // rounding + the track's own box; without it the fan
                          // lands a few px wide and clips its leftmost tile
  const room = avail - PAD;
  const n = chips.length;

  // r805 (owner): one rule in both orientations. The phone's Trick tray is a
  // full-width bar now (css/phone-trays.css), so the zigzag (r486) and the tilt
  // that took turns straightening (r399 / r408) are gone. A row that fits is an
  // ordinary row; one that does not TUCKS, each tile showing at least half of
  // itself, and past that floor the row keeps the 50% step and SCROLLS sideways
  // (scrollbar hidden), scrolled to the end so the newest Trick starts visible.
  // A covered Trick comes forward under the pointer or a thumb (js/tray-lift.js).
  const LGAP = landscape ? 5 : GAP;
  if (n * tile + (n - 1) * LGAP <= room) {
    track.style.setProperty('--fan-gap', LGAP + 'px');   // fits: an ordinary row
    return true;
  }
  const minStep = Math.ceil(tile * 0.5);
  const step = Math.max(minStep, (room - tile) / (n - 1));
  track.style.setProperty('--fan-gap', (step - tile).toFixed(2) + 'px');
  list.classList.add('fanned');
  requestAnimationFrame(() => { list.scrollLeft = list.scrollWidth; });
  return true;
}
