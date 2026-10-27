// ══════════════════════════════════════════════════════════════════════════════
// THE TRICK AND THE SLEIGHT THAT CHANGE EVERY ROUND (r676, owner; CHALLENGE_REWARDS.md
// section 7). Working names: Temp (Trick, `changeling`) and Floater (Sleight, `floater`).
// ══════════════════════════════════════════════════════════════════════════════
// At the start of each round (chgRoundStart, from startRoundTimer, once a level)
// each becomes a random one of its kind, drawn FLAT (no rarity, no Luck), never
// the same one twice in a row, and does that for the round. Taken during a round,
// it changes at once. Its improvement tier is the form's tier.
//
// TEMP stands in for its form the way a fused Trick stands in for its parts
// (r651): its tray object carries `acts: [form]`, so hasTrick(form) is true and
// the form's payouts are billed to Temp's chip (_fid). ownedTrickObj(form) finds
// Temp, so per-Trick state (rolled ranks, a line) lives on it and is cleared at
// each change. entityTier[form] is set to Temp's tier, so BAL[form] reads at it.
// A line form marks a random line for the round. It is never drawn as a Trick
// already in the tray, nor one that grows from when you take it or round by round
// (owner, r665), and it never completes an Inseparable pair (inseparableCompletes
// counts real tray Tricks only).
//
// FLOATER is a deck card whose sleightId IS its form (`_floater` marks it and rides
// discardToPlayed's rebuild). Its own charges are shared by every form; a form that
// never spends one (infinite) spends one at the next change if the card was on the
// board. At 0 it leaves the deck for good, like any spent Sleight.

const CHG_TRICK_ID = 'changeling', CHG_SLEIGHT_ID = 'floater';
const CHG_TRICK_OUT = new Set(['mirror', 'middle_man', 'compound_mult', 'acorns', 'fives_discard', 'tens_mult', 'more_better', 'feng_shui',
  'relentless', 'quick_draw', 'expanse', 'little_guys', 'nines_mult', 'rising_tide', 'life_lessons', 'assembly_line']);
const CHG_SLEIGHT_OUT = new Set(['slow_burn', 'whetstone']);
// Rolled state a form keeps on its tray object, cleared when the form changes.
const CHG_FORM_FIELDS = ['_posAxis', '_posIndex', '_posDescBase', '_posAssigned', '_luckyRanks', '_luckySells',
  '_heartRanks', '_prRanks', '_critFamily', '_carry', '_countAdj', '_tiltDir'];
var chgLevel = null;      // the level whose round last changed them - SAVE_VARS
var chgTrickForm = null;  // Temp's last form, so its tier can be dropped when Temp goes - SAVE_VARS

function chgTrickObj() { return (typeof trickTray !== 'undefined' ? trickTray : []).find(t => t && t.id === CHG_TRICK_ID) || null; }
// ownedTrickObj's fallback (js/improve.js): Temp, while its form is `id`.
function changelingFor(id) { const t = chgTrickObj(); return t && t._form && t._form === id ? t : null; }
function chgRoundLive() { return typeof roundEnded !== 'undefined' && !roundEnded && !(typeof mapScreenOpen !== 'undefined' && mapScreenOpen); }
const _chgFlat = a => (a.length ? a[Math.floor(Math.random() * a.length)] : null);

// ── Temp ────────────────────────────────────────────────────────────────────
function chgTrickPool(prev, self) {
  // Never a Trick the tray already has, or one a fused Trick already stands in for.
  const held = id => trickTray.some(x => x && x !== self && (x.id === id || (x.acts && x.acts.includes(id))));
  return TRICK_POOL.filter(t => t && !t.retired && !t.fused && t.id !== CHG_TRICK_ID && t.id !== prev && !held(t.id)
    && !CHG_TRICK_OUT.has(t.id) && !(typeof survivalEntityBanned === 'function' && survivalEntityBanned(t.id)));
}
// The form's tier is Temp's; the last form's goes (unless a real copy owns it).
function chgFormTier(prev, next) {
  if (prev && prev !== next && !trickTray.some(t => t && t.id === prev)) delete entityTier[prev];
  if (next) { const k = entityTierOf(CHG_TRICK_ID); if (k > 0) entityTier[next] = k; else delete entityTier[next]; }
  chgTrickForm = next || null;
  applyEntityTiers();
}
// The improvement rolls a form makes at its tier (ranks, a family, a tier jump, a
// second line). Only for a tier above 0, the same as improving it would.
function chgFormHooks(t, form) {
  const tier = entityTierOf(form);
  const hook = IMPROVE_HOOKS[form];
  if (!hook || tier <= 0 || form === 'nines_mult') return;
  const jump = hook(tier, t);
  if (typeof jump === 'number' && jump > tier) { entityTier[form] = Math.min(IMPROVE_MAX_TIER, jump); applyEntityTiers(); hook(entityTier[form], t); }
}
// A line form marks a random line, free if one is (District lets it share). It
// does not move the run's row / column alternation.
function chgMarkLine(t) {
  const pick = pickDefaultLine(['row', 'col'], hasKnack('district'));
  if (pick) { t._posAssigned = true; finalizePositionMark(t, pick.axis, pick.index); }
}
// Temp's printed sentence: the form's, under its name.
function changelingDescApply(t) {
  const base = (typeof TRICK_POOL_ALL !== 'undefined' ? TRICK_POOL_ALL : TRICK_POOL).find(x => x.id === CHG_TRICK_ID);
  const def = t._form ? TRICK_POOL_ALL.find(x => x.id === t._form) : null;
  if (base) t.name = base.name;
  t.desc = def ? `${def.name} this round: ${def.desc}` : (base ? base.desc : t.desc);
  if (t._posAxis != null && typeof positionDescApply === 'function') { t._posDescBase = t.desc; positionDescApply(t); }
}
function chgSetTrickForm(t, form, quiet) {
  if (typeof rowColBonuses !== 'undefined') rowColBonuses = rowColBonuses.filter(b => b._trickRef !== t);
  CHG_FORM_FIELDS.forEach(k => { delete t[k]; });
  const prev = t._form;
  t._form = form || null; t.acts = form ? [form] : [];
  chgFormTier(prev, form);
  if (form) {
    if (form === 'feelin_lucky' && typeof feelinLuckyRoll === 'function') feelinLuckyRoll(t);
    chgFormHooks(t, form);
    if (typeof POSITION_ASSIGN_IDS !== 'undefined' && POSITION_ASSIGN_IDS.includes(form)) chgMarkLine(t);
  }
  changelingDescApply(t);
  if (typeof renderTrickTray === 'function') renderTrickTray();
  const def = form && TRICK_POOL_ALL.find(x => x.id === form);
  if (def && !quiet) showMessage(`${t.name} is ${def.name} this round`, '#e8dd54');
}
function chgChangeTrick() {
  const t = chgTrickObj(); if (!t) return;
  const pick = _chgFlat(chgTrickPool(t._form, t));
  chgSetTrickForm(t, pick ? pick.id : null);
  if (typeof trayFxKick === 'function') { const tray = document.querySelector('#trick-tray-area, .tray'); if (tray) trayFxKick(tray, 'in'); }
}
// selectTrick: Temp is taken. The tray holds its own copy (the pool row stays
// clean), and during a round it changes at once.
function changelingPickup(trick) {
  const copy = { ...trick };
  const i = trickTray.indexOf(trick); if (i >= 0) trickTray[i] = copy;
  const a = acquiredTricks.indexOf(trick); if (a >= 0) acquiredTricks[a] = copy;
  copy._form = null; copy.acts = [];
  if (chgRoundLive()) chgChangeTrick();
  return copy;
}
// Temp left the tray (sold, removed): its form's borrowed tier goes with it.
function chgTrickGone() {
  if (chgTrickObj() || !chgTrickForm) return;
  if (!trickTray.some(t => t && t.id === chgTrickForm)) { delete entityTier[chgTrickForm]; applyEntityTiers(); }
  chgTrickForm = null;
}

// ── Floater ─────────────────────────────────────────────────────────────────
function chgFloaterCards() { return (typeof allOwnedSleightCards === 'function' ? allOwnedSleightCards() : []).filter(c => c && c._floater); }
function chgSleightPool(prev) {
  const own = new Set(allOwnedSleightCards().filter(c => !c._floater).map(c => c.sleightId));
  return SLEIGHT_POOL.filter(d => d && d.id !== CHG_SLEIGHT_ID && d.id !== prev && !own.has(d.id) && !CHG_SLEIGHT_OUT.has(d.id)
    && d.rarity !== 'fixture' && (typeof sleightOfferable !== 'function' || sleightOfferable(d))
    && !(typeof survivalEntityBanned === 'function' && survivalEntityBanned(d.id)));
}
function _chgCellOf(card) {
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) if (gridData[r]?.[c] === card) return [r, c];
  return null;
}
function chgChangeFloater(card, noRender) {
  const was = card._floater ? card.sleightId : null, wasDef = was && SLEIGHT_POOL.find(d => d.id === was);
  // A form that never spent a charge (infinite) pays one for the round it was on the board.
  if (card._floatSeen && wasDef && wasDef.durability === 'infinite' && typeof card._usesLeft === 'number') card._usesLeft = Math.max(0, card._usesLeft - 1);
  card._floatSeen = false;
  const at = _chgCellOf(card);
  if (typeof card._usesLeft === 'number' && card._usesLeft <= 0 && !(typeof greenStationKeeps === 'function' && greenStationKeeps())) {
    // Spent: off the deck for good (a card on the board leaves when it goes).
    [drawPile, playedPile].forEach(p => { const i = p.indexOf(card); if (i >= 0) p.splice(i, 1); });
    noteMessage(`${SLEIGHT_POOL.find(d => d.id === CHG_SLEIGHT_ID)?.name || 'Floater'} is spent`);
    return;
  }
  const def = _chgFlat(chgSleightPool(was));
  if (!def) return;
  if (was && was !== def.id && !allOwnedSleightCards().some(c => c !== card && c.sleightId === was)) delete entityTier[was];
  const k = entityTierOf(CHG_SLEIGHT_ID);
  if (k > 0) entityTier[def.id] = k; else delete entityTier[def.id];
  applyEntityTiers();
  card._floater = true;
  card.sleightId = def.id;
  ['_ruleLanded', '_ruleRanks', '_inert', '_usedThisRound', '_apLanded', '_apSecs', '_apEngaged', '_keepMode', '_adjPlays', '_whetMult', '_gridSecs'].forEach(f => { delete card[f]; });
  if (at && !noRender && typeof render === 'function') {
    render();
    const el = document.querySelector(`#grid [data-card-id="${card._id}"]`);
    if (el && typeof el.animate === 'function') el.animate([{ rotate: 'y 0deg' }, { rotate: 'y 90deg', offset: .5 }, { rotate: 'y 0deg' }], { duration: 460, easing: 'ease-in-out' });
  }
  return def;
}
// render's top (beside the rule Sleights' scan): a Floater on the board is seen
// this round, and one that has not changed yet changes now if a round is live.
function chgScan() {
  for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
    const cd = gridData[r]?.[c];
    if (!cd || !cd._isSleight) continue;
    if (cd.sleightId === CHG_SLEIGHT_ID && chgRoundLive()) { cd._floater = true; chgChangeFloater(cd, true); }
    if (cd._floater && chgRoundLive()) cd._floatSeen = true;
  }
}

// ── The change ──────────────────────────────────────────────────────────────
function chgRoundStart() {
  chgTrickGone();
  if (chgLevel === level) return;
  chgLevel = level;
  if (chgTrickObj()) chgChangeTrick();
  allOwnedSleightCards().filter(c => c._floater || c.sleightId === CHG_SLEIGHT_ID).forEach(c => {
    c._floater = true;
    const def = chgChangeFloater(c);
    if (def) showMessage(`${SLEIGHT_POOL.find(d => d.id === CHG_SLEIGHT_ID)?.name || 'Floater'} is ${def.name} this round`, '#c07aee');
  });
}

// ── Improvements: the tier passes to the form ───────────────────────────────
IMPROVE_PLAN[CHG_TRICK_ID] = () => ({});
IMPROVE_PLAN[CHG_SLEIGHT_ID] = () => ({});
IMPROVE_HOOKS[CHG_TRICK_ID] = (tier, t) => {
  if (!t || !t._form) return;
  entityTier[t._form] = tier; applyEntityTiers();
  chgFormHooks(t, t._form);
  changelingDescApply(t);
};
// downgradeEntity runs no hook: the form's tier follows Temp's / Floater's here.
function chgSyncTiers(id) {
  if (id === CHG_TRICK_ID) { const t = chgTrickObj(); if (t && t._form) { entityTier[t._form] = entityTierOf(CHG_TRICK_ID); applyEntityTiers(); changelingDescApply(t); } }
  if (id === CHG_SLEIGHT_ID) IMPROVE_HOOKS[CHG_SLEIGHT_ID](entityTierOf(CHG_SLEIGHT_ID));
}
IMPROVE_HOOKS[CHG_SLEIGHT_ID] = tier => {
  chgFloaterCards().forEach(c => { if (c.sleightId !== CHG_SLEIGHT_ID) entityTier[c.sleightId] = tier; });
  applyEntityTiers();
};
