// ══════════════════════════════════════════════════════════════════════════════
// THE CHALLENGE KNACKS (r685, owner): Trophy Case (working name) and Very Rewarding
// ══════════════════════════════════════════════════════════════════════════════
// Both change what a completed challenge card pays. Every card payout goes through
// crrPayCard (crCollect, and the round-end settlements crSpotSettle /
// crSettleRound); the Schedule's leave-early pay does not, so neither knack
// touches it. Penalties are untouched.
//
// TROPHY CASE (`trophy_case`): the card turns into a random Sleight instead of
// paying. Common or rare at first; BAL.trophy_case.epic / .legend open those
// rarities; .starts is the version it arrives at (v2 = one improvement). Taken
// during a round the Sleight takes the card's cell (crDrain reads q.becomes);
// paid at a round's end it goes into the deck. It replaces the WHOLE payout.
// With Very Rewarding too (r690, owner: combine them) the card turns into
// BAL.very_rewarding.times Sleights: the first takes the cell, the rest go to the
// deck, and Very Rewarding's bonus reward is paid as usual.
//
// VERY REWARDING (`very_rewarding`): the card's reward pays BAL.very_rewarding.times
// times; from v3 a bonus reward is paid too, a random easy (Standard) or hard reward
// at stage 1 or 2 (`hard`, `stage`), as if one more card had been completed.

function trophyCasePool() {
  const b = BAL.trophy_case || {};
  const ok = new Set(['common', 'rare']);
  if (b.epic) ok.add('epic');
  if (b.legend) { ok.add('legendary'); ok.add('mythic'); }
  const granted = typeof _grantedSleightSet === 'function' ? _grantedSleightSet() : new Set();
  return SLEIGHT_POOL.filter(j => j && ok.has(j.rarity || 'common') && sleightOfferable(j) && !granted.has(j.id)
    && !(typeof survivalEntityBanned === 'function' && survivalEntityBanned(j.id)));
}
// Grant one; the new card is taken back out of the draw pile and returned.
function trophyCaseGrant() {
  const pool = trophyCasePool(); if (!pool.length) return null;
  const def = pickEntityByRarity(pool, j => j.rarity || 'common') || pool[0];
  const start = Math.max(0, ((BAL.trophy_case && BAL.trophy_case.starts) || 1) - 1);
  if (start > entityTierOf(def.id)) {
    entityTier[def.id] = Math.min(IMPROVE_MAX_TIER, start); applyEntityTiers();
    const hook = IMPROVE_HOOKS[def.id]; if (hook) { try { hook(entityTier[def.id], null); } catch (e) {} }
    if (typeof markTierSeen === 'function') markTierSeen(def.id, entityTier[def.id]);
  }
  grantSleight(def);
  const card = drawPile[drawPile.length - 1];
  return card && card.sleightId === def.id ? { def, card } : { def, card: null };
}
function trophyCasePay(q, ctx) {
  const got = trophyCaseGrant();
  if (!got) return CRR.credits.say(q.banked) + (CRR.credits.give(q.banked, ctx) || '');
  const v = entityTierOf(got.def.id) + 1, name = `${got.def.name}${v > 1 ? ` v${v}.0` : ''}`;
  if (ctx.cd && ctx.live && got.card) {
    // It takes the card's cell when the card leaves (crDrain).
    const i = drawPile.lastIndexOf(got.card); if (i >= 0) drawPile.splice(i, 1);
    q.becomes = got.card;
    return `it became ${name}`;
  }
  return `${name} added to your deck`;
}

// ── Very Rewarding ──────────────────────────────────────────────────────────
function veryRewardingBonus() {
  const b = BAL.very_rewarding || {};
  if (!b.bonus) return null;
  const t = b.stage ? 1 : 0;
  const ids = (b.hard ? CRR_HARD : CRR_STD).filter(id => CRR[id] && CRR[id].can(t));
  return ids.length ? { id: ids[Math.floor(Math.random() * ids.length)], t } : null;
}

// THE one payout of a completed challenge card (stage `t` of its reward).
function crrPayCard(q, t, ctx) {
  ctx = ctx || {};
  const has = id => typeof hasKnack === 'function' && hasKnack(id);
  const n = (has('very_rewarding') && BAL.very_rewarding) ? BAL.very_rewarding.times : 1;
  const said = [];
  if (has('trophy_case')) {
    // Only the first can take the card's cell; the rest go straight into the deck.
    for (let i = 0; i < n; i++) said.push(trophyCasePay(q, i ? { live: ctx.live } : ctx));
  } else {
    const id = crPayOf(q);
    said.push(crrGrant(id, t, ctx));
    for (let i = 1; i < n; i++) said.push(crrGrant(id, t, { live: ctx.live }));
  }
  let out = said.every(s => s === said[0]) && n > 1 ? `${said[0]} ×${n}` : said.join(' · ');
  if (n > 1 && ctx.el) setTimeout(() => crrRise(ctx.el, `×${n}`, CRR_GOLD, 1.3), 260);
  const bonus = n > 1 ? veryRewardingBonus() : null;
  if (bonus) {
    out += ` · bonus: ${crrGrant(bonus.id, bonus.t, { live: ctx.live })}`;
    if (ctx.el) setTimeout(() => crrRise(ctx.el, 'BONUS', CRR_GOLD, 1.2), 620);
  }
  if (n > 1) { const tray = document.getElementById('knack-list'); if (tray && typeof trayFxTrigger === 'function') trayFxTrigger(tray); }
  return out;
}
