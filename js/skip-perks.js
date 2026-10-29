// ══════════════════════════════════════════════════════════════════════════
// LONG LUNCH (r706, owner): what leaving a Schedule slot early pays.
//
// Leaving a slot after one booking (wide shape only) still moves the curve one
// step for each booking left behind (mapConfirm), so a skip never lowers a later
// goal. What it buys is one perk from LUNCH_PERKS, rolled when you leave. The
// quarter's department makes its own perk DEPT_CFG.lunchMult (4) times as
// likely; that perk is what the bar and the ? card name ("usually ..."). The
// whole table is never shown to the player (owner).
//
// A perk that cannot land right now is not rolled; with none left, credits.
// Every weight is in PROB_TABLES ('lunch'). Rows that reuse a challenge reward
// pay through CRR (js/challenge-rewards.js) with the same words.
// ══════════════════════════════════════════════════════════════════════════

// Owner's table: Permaprime 25%, an improvement of your choice 5%, the rest share
// what is left evenly (a random improvement as likely as the others).
const LUNCH_W = { charges: 70 / 6, permaprime: 25, stock: 70 / 6, path: 70 / 6,
                  cardbuff: 70 / 6, improve: 70 / 6, credits: 70 / 6, pick: 5 };
const LUNCH_CHARGES = 5;
const LUNCH_CREDITS = [10, 20];

// A Sleight's charges, walked over every card you own (allOwnedSleightCards).
function _lunchSleights() {
  return (typeof allOwnedSleightCards === 'function' ? allOwnedSleightCards() : [])
    .filter(c => c && c._usesLeft !== 'infinite' && sleightCapOf(c) != null);
}
function _lunchTricks() { return (typeof trickTray !== 'undefined' ? trickTray : []).filter(t => t && t.id); }

const LUNCH_PERKS = {
  charges: {
    say: `+${LUNCH_CHARGES} Sleight charges`, short: `+${LUNCH_CHARGES} CHARGES`,
    can: () => _lunchSleights().some(c => (c._usesLeft || 0) < sleightCapOf(c)),
    // One at a time to the Sleight with the fewest left, never past its cap.
    give() {
      let n = 0;
      for (let k = 0; k < LUNCH_CHARGES; k++) {
        const open = _lunchSleights().filter(c => (c._usesLeft || 0) < sleightCapOf(c));
        if (!open.length) break;
        const low = open.reduce((a, b) => ((b._usesLeft || 0) < (a._usesLeft || 0) ? b : a));
        low._usesLeft = (low._usesLeft || 0) + 1;
        n++;
      }
      if (typeof crrFlashSleights === 'function') crrFlashSleights('crr-charge-up');
      return `+${n} Sleight charge${n === 1 ? '' : 's'}`;
    },
  },
  permaprime: {
    say: 'a random Trick is permaprimed', short: 'PERMAPRIME',
    can: () => _lunchTricks().length > 0,
    give() {
      const ts = _lunchTricks(), t = ts[Math.floor(Math.random() * ts.length)];
      permaprimeTrick(t);
      return `${t.name} is permaprimed`;
    },
  },
  stock: {
    say: '+1 swap and +1 discard every round', short: '+1 SWAP +1 DISCARD',
    can: () => ['swaps', 'discards'].some(id => limits[id] && limits[id].current < limits[id].max),
    // Permanent: the two limits. A two-limit grant knocks on once (Knock-On).
    give() {
      const a = incrementLimit('swaps'), b = incrementLimit('discards', { noKnockOn: a });
      return a && b ? '+1 swap and +1 discard every round' : a ? '+1 swap every round' : '+1 discard every round';
    },
  },
  path: {
    get say() { return `+2 path on your next ${gridName('reward')}`; }, short: '+2 PATH',
    // Never stacks: one waiting bonus at a time.
    can: () => typeof crGridBonus === 'undefined' || crGridBonus <= 0,
    give() { return crrGrant('grid', 1, { live: false }); },
  },
  cardbuff: {
    say: '3 random deck cards take a buff', short: '3 BUFFS',
    can: () => CRR.cardbuff.can(0),
    give() { return crrGrant('cardbuff', 0, { live: false }); },
  },
  improve: {
    say: 'a random improvement', short: '+1 TIER',
    can: () => CRR.improve.can(0),
    give() { return crrGrant('improve', 0, { live: false }); },
  },
  credits: {
    say: `+${LUNCH_CREDITS[0]} to ${LUNCH_CREDITS[1]} credits`, short: `+${creditsTxt(LUNCH_CREDITS[0])}-${LUNCH_CREDITS[1]}`,
    can: () => true,
    give() {
      const n = LUNCH_CREDITS[0] + Math.floor(Math.random() * (LUNCH_CREDITS[1] - LUNCH_CREDITS[0] + 1));
      coins += n; if (typeof updateCoinsUI === 'function') updateCoinsUI();
      return `+${n} credits`;
    },
  },
  pick: {
    say: 'an improvement of your choice', short: '+1 TIER (PICK)',
    can: () => CRR.improve.can(1),
    give() { return crrGrant('improve', 1, { live: false }); },
  },
};

// The department's perk and its weight multiplier.
function lunchDeptPerk() { const d = (typeof mapDept === 'function') ? mapDept() : null; return d && d.lunch && LUNCH_PERKS[d.lunch] ? d.lunch : null; }
function lunchWeights() {
  const w = { ...LUNCH_W }, own = lunchDeptPerk();
  if (own) w[own] *= (typeof DEPT_CFG !== 'undefined' && DEPT_CFG.lunchMult) || 4;
  return w;
}
// The department's perk and its chance, as the bar and the ? card print it.
function lunchLikely() {
  const own = lunchDeptPerk(); if (!own) return null;
  const w = lunchWeights(), sum = Object.values(w).reduce((a, b) => a + b, 0);
  return { id: own, say: LUNCH_PERKS[own].say, short: LUNCH_PERKS[own].short, pct: Math.round(100 * w[own] / sum) };
}
function lunchLikelySay() {
  const L = lunchLikely();
  return L ? `Long lunch in ${mapDept().name}: most often ${L.say} (${L.pct}%).` : 'Long lunch: a random perk.';
}

// Roll and pay. Returns the line the notice prints.
function longLunch() {
  const w = lunchWeights();
  const ids = Object.keys(LUNCH_PERKS).filter(id => (w[id] || 0) > 0 && LUNCH_PERKS[id].can());
  if (!ids.length) return LUNCH_PERKS.credits.give();
  let r = Math.random() * ids.reduce((a, id) => a + w[id], 0), pick = ids[ids.length - 1];
  for (const id of ids) { r -= w[id]; if (r < 0) { pick = id; break; } }
  if (typeof dbgEvent === 'function') dbgEvent('lunch', pick);
  return LUNCH_PERKS[pick].give();
}

// ── Permaprime ───────────────────────────────────────────────────────────────
// A permanent prime: the Trick fires one more time every time it fires, for the
// rest of the run. It is `_rank` (trickFires = 1 + _primed + _rank + mirrors),
// the same thing Extra Rep's Permaprime upgrade grants. A Trick can hold several.
function permaprimeTrick(t) {
  if (!t) return;
  t._rank = (t._rank || 0) + 1;
  if (typeof renderTrickTray === 'function') renderTrickTray();
}
