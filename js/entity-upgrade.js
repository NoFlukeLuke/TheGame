// ══════════════════════════════════════════════
// ENTITY UPGRADE (r197) - one verb for "make this owned thing better"
// ══════════════════════════════════════════════
// Three of the r197 events want the same verb, and the levers to do it already
// existed - one per entity type, each invented by the event that needed it:
//
//   Trick   ->  t._rank           (Rehearsal, r194)  fires an extra time a hand
//   Sleight ->  sleightCapBonus   (The Workshop, r194) a higher charge ceiling
//
// This file is only the seam over those two. It invents no new mechanic, which
// is why an upgrade event costs so little: everything downstream of _rank and
// sleightCapBonus already works on all 177 Tricks and every Sleight.
//
// KNACKS ARE DELIBERATELY NOT UPGRADEABLE, and nothing offers one. A knack is a
// rule change with no numeric handle - its effect is read straight out of BAL at
// thirty-odd call sites, so "one tier better" would mean routing every one of
// them through a scaler. Putting a knack on a reel and then having nothing to
// give it would read as a bug, so it is kept off the list entirely.

// Every Trick and Sleight the run holds, in the one shape the upgrade UIs use.
// `ref` is what upgradeEntity writes through: the tray's own Trick object, or
// the Sleight's DEFINITION - the cap bonus is stored per sleightId, so every
// copy in the deck shares one upgrade.
function upgradeableEntities() {
  const out = [];
  if (typeof trickTray !== 'undefined' && trickTrayMode) {
    trickTray.forEach(t => out.push({
      kind: 'trick', id: t.id, name: t.name, rarity: t.tier, ref: t,
      emoji: (typeof trickEmoji === 'function') ? trickEmoji(t) : '✦',
    }));
  }
  if (typeof allOwnedSleightCards === 'function') {
    const seen = new Set();
    allOwnedSleightCards().forEach(c => {
      const def = sleightDef(c);
      // An infinite Sleight has no ceiling to raise, so there is nothing to give it.
      if (!def || seen.has(def.id) || sleightMaxCharges(def) === null) return;
      seen.add(def.id);
      out.push({ kind: 'sleight', id: def.id, name: def.name, rarity: def.rarity, ref: def, emoji: def.emoji || '▶' });
    });
  }
  return out;
}

// What this entity has already been given, as a short suffix for a tile. Empty
// when it is still stock, so an untouched loadout reads clean.
function entityUpgradeLabel(ent) {
  if (!ent) return '';
  if (ent.kind === 'trick')   { const r = ent.ref._rank || 0; return r ? `×${r + 1} a hand` : ''; }
  if (ent.kind === 'sleight') { const b = sleightCapBonus[ent.id] || 0; return b ? `+${b} charges` : ''; }
  return '';
}

// What one step WOULD do, for a tile that has not been picked yet.
function entityUpgradeHint(ent) {
  if (!ent) return '';
  return ent.kind === 'trick'
    ? 'Fires one more time every hand.'
    : 'Holds one more charge, and refills to the new ceiling.';
}

// Apply `steps` upgrades. Returns a one-line summary for showMessage, or ''.
function upgradeEntity(ent, steps = 1) {
  if (!ent || steps <= 0) return '';
  if (ent.kind === 'trick') {
    ent.ref._rank = (ent.ref._rank || 0) + steps;
    if (typeof renderTrickTray === 'function') renderTrickTray();
    return `${ent.name} now fires ${ent.ref._rank + 1}× a hand`;
  }
  if (ent.kind === 'sleight') {
    sleightCapBonus[ent.id] = (sleightCapBonus[ent.id] || 0) + steps;
    const cap = sleightMaxCharges(ent.ref);
    // Refill every copy to the NEW ceiling - the bonus is per sleightId, so the
    // copies all share it (the same reason The Workshop does this).
    if (typeof allOwnedSleightCards === 'function') {
      allOwnedSleightCards().forEach(c => { if (c.sleightId === ent.id) c._usesLeft = cap; });
    }
    return `${ent.name} reinforced - ${cap} charges`;
  }
  return '';
}
