// ══════════════════════════════════════════════
// OWNED OFFERS (r799, owner): the Old Tricks Knack, reworked
// ══════════════════════════════════════════════
// With Old Tricks, Tricks, Knacks and Sleights you already own can stand on the
// company store's shelves at the ordinary odds (ownedAllowIds / ownedMark, called by the
// three shelf builders in js/shop-grid-preview.js). Buying one opens a typed command-line screen on the
// board (ownedAsk): take a second copy, or improve the original. Click a line, or
// on a desktop type one or two and press Enter.
//
// A SECOND COPY ONLY WHERE A COPY DOES SOMETHING (ownedCanCopy):
//   Sleight  always: one more card in the deck.
//   Trick    only one whose scoring is a behaviour in js/trick-fx/ (the tray walk
//            runs each copy, FX_COPIES), with no line and no pickup state, and a
//            free Trick slot. Both copies share the Trick's improvements.
//   Knack    never: a Knack is held or not.
// An owned entity that can neither be copied nor improved is not put on a shelf.
// TBD: the two copies' chips fly from the first copy's tray tile, and primes are
// read per Trick id, not per copy.
// Tricks whose pickup writes run state or a line: a second copy would reset or double it.
const OWNED_NO_COPY = new Set(['feelin_lucky', 'nines_mult', 'rising_tide', 'assembly_line', 'middle_man', 'fire_sale', 'changeling', 'tens_mult']);

function ownedOffersOn() { return typeof hasKnack === 'function' && hasKnack('old_tricks'); }
function ownedTrickCopyable(id) {
  const fx = (typeof TRICK_FX !== 'undefined') ? TRICK_FX[id] : null;
  if (!fx || !(fx.card || fx.cardXMult || fx.handAdd || fx.handX)) return false;
  if (OWNED_NO_COPY.has(id)) return false;
  if (typeof POSITION_ASSIGN_IDS !== 'undefined' && POSITION_ASSIGN_IDS.includes(id)) return false;
  const row = TRICK_POOL_ALL.find(t => t.id === id);
  return !!row && !row.fused && !row.retired;
}
// null when a copy can be taken; else the reason it cannot.
function ownedCopyBlock(type, id) {
  if (type === 'sleight') return null;
  if (type === 'knack') return 'a Knack cannot be held twice';
  if (!ownedTrickCopyable(id)) return 'a second copy of this Trick would do nothing';
  if (typeof trickTrayFull === 'function' && trickTrayFull()) return 'no free Trick slot';
  return null;
}
function ownedImproveBlock(id) { return (typeof canImprove === 'function' && canImprove(id)) ? null : 'it cannot be improved further'; }
function ownedOfferable(type, id) { return !ownedCopyBlock(type, id) || !ownedImproveBlock(id); }

// The owned entities a shelf of `type` may show: [{ def, id }].
function ownedShelfPool(type) {
  let list = [];
  if (type === 'trick') list = (typeof trickTray !== 'undefined' ? trickTray : []).filter(t => t && !t.fused && t.id !== 'changeling' && !(typeof SURVIVAL_STACKABLE_TRICKS !== 'undefined' && SURVIVAL_STACKABLE_TRICKS.includes(t.id))).map(t => TRICK_POOL_ALL.find(r => r.id === t.id)).filter(Boolean);
  else if (type === 'knack') list = (typeof acquiredKnacks !== 'undefined' ? acquiredKnacks : []).filter(k => k && k.id !== 'old_tricks').map(k => KNACK_POOL.find(r => r.id === k.id)).filter(Boolean);
  else if (type === 'sleight') {
    const ids = new Set((typeof allOwnedSleightCards === 'function' ? allOwnedSleightCards() : []).filter(c => c && !c._floater).map(c => c.sleightId));
    list = [...ids].map(id => SLEIGHT_POOL.find(d => d.id === id)).filter(d => d && !d.retired);
  }
  const seen = new Set();
  return list.filter(d => !seen.has(d.id) && seen.add(d.id) && ownedOfferable(type, d.id));
}
// r808 (owner): an owned entity joins its shelf's pool at the ordinary odds, no more
// likely than anything else. `ownedAllowIds(type)` is what the shelf may keep in;
// `ownedMark(type, payloads)` turns a payload of an owned id into the copy-or-improve buy.
function ownedAllowIds(type) { return ownedOffersOn() ? new Set(ownedShelfPool(type).map(d => d.id)) : new Set(); }
function ownedMark(type, payloads) {
  const allow = ownedAllowIds(type);
  if (!allow.size) return payloads;
  return payloads.map(p => {
    const def = p._def; if (!def || p._buyback || !allow.has(def.id) || !ownedIsHeld(type, def.id)) return p;
    p.owned = true; p.desc = 'You own this. ' + (p.desc || '');
    p.buy = () => ownedBought(type, def);
    return p;
  });
}
function ownedIsHeld(type, id) {
  if (type === 'trick') return (typeof trickTray !== 'undefined') && trickTray.some(t => t && t.id === id);
  if (type === 'knack') return (typeof acquiredKnacks !== 'undefined') && acquiredKnacks.some(k => k && k.id === id);
  return (typeof _grantedSleightSet === 'function') && _grantedSleightSet().has(id);
}

// ── The purchase ─────────────────────────────────────────────────────────────
const _ooQueue = []; let _ooBusy = false;
function ownedBought(type, def) { _ooQueue.push({ type, def }); if (!_ooBusy) ownedNext(); }
function ownedNext() {
  const e = _ooQueue.shift();
  if (!e) { _ooBusy = false; return; }
  _ooBusy = true;
  ownedAsk(e.type, e.def, n => { ownedApply(e.type, e.def, n); setTimeout(ownedNext, 250); });
}
function ownedApply(type, def, n) {
  if (n === 1) {
    if (type === 'sleight') grantSleight(def);
    else if (type === 'trick') injectTrickAfterReward({ ...def });
    noteMessage(`${def.name}: second copy taken`);
  } else {
    improveEntity(def.id);
  }
  if (typeof shopGridActive !== 'undefined' && shopGridActive && typeof renderShopGrid === 'function') { try { renderShopGrid(); } catch (e) {} }
}
// r809 (owner): the pick-of-three screens and Flow's Tricks / Knacks / Sleights steps
// offer owned entities too, at the ordinary odds (ownedAllowIds in their pools).
// `ownedHeld(type, id)` says an offer is one you hold (the take asks copy or improve);
// `ownedTake(type, def, then)` asks, applies, then runs the screen's own tail.
function ownedHeld(type, id) { return ownedOffersOn() && ownedAllowIds(type).has(id) && ownedIsHeld(type, id); }
function ownedTake(type, def, then) {
  ownedAsk(type, def, n => { if (n) ownedApply(type, def, n); if (then) setTimeout(then, 250); });
}
// What a typed answer means: 1 / one, 2 / two.
function ownedParse(v) {
  const s = String(v || '').trim().toLowerCase();
  return (s === '1' || s === 'one') ? 1 : (s === '2' || s === 'two') ? 2 : 0;
}
function ownedAsk(type, def, done) {
  const b1 = ownedCopyBlock(type, def.id), b2 = ownedImproveBlock(def.id);
  // Bought with nothing it can do (the tray filled since the shelf was dealt): improve if possible, else nothing.
  if (b1 && b2) { noteMessage(`${def.name}: nothing to do with a second one`); done(0); return; }
  const typing = typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches;
  const opt = (n, text, block) => `<button type="button" class="oo-opt${block ? ' oo-off' : ''}" data-n="${n}"${block ? ' disabled' : ''}><span class="oo-t">${text}</span>${block ? `<small>Not this time: ${block}.</small>` : ''}</button>`;
  const ctl = (typeof boardScreenOpen === 'function') ? boardScreenOpen({
    head: `> ${String(def.name).toUpperCase()}`, cls: 'oo-screen', zIndex: 10002,
    html: `<div class="oo-say"><span class="oo-t">You've purchased an entity you already own.</span></div>` +
      opt(1, 'Take additional copy?', b1) + opt(2, 'Improve the original.', b2) +
      (typing ? `<label class="oo-in"><span>&gt;</span><input type="text" maxlength="5" spellcheck="false" autocomplete="off" placeholder="type one or two"></label>` : ''),
  }) : null;
  if (!ctl) { done(b2 ? 1 : 2); return; }
  let over = false;
  // While it is up no key reaches the game. A key typed anywhere goes to the line.
  const keys = e => {
    if (over || e.target.closest?.('.oo-in')) return;
    e.stopPropagation(); if (e.key !== 'Tab') e.preventDefault();
    const inp = ctl.body.querySelector('.oo-in input'); if (!inp) return;
    inp.focus();
    if (e.key === 'Enter') submit();
    else if (e.key === 'Backspace') inp.value = inp.value.slice(0, -1);
    else if (e.key.length === 1 && inp.value.length < 5) inp.value += e.key;
  };
  const submit = () => {
    const inp = ctl.body.querySelector('.oo-in input'); if (!inp) return;
    const n = ownedParse(inp.value);
    if (!n || (n === 1 ? b1 : b2)) { inp.value = ''; if (typeof refuse === 'function') { try { refuse(); } catch (x) {} } } else choose(n);
  };
  document.addEventListener('keydown', keys, true);
  const choose = n => {
    if (over || !n || (n === 1 ? b1 : b2)) { if (!over && typeof refuse === 'function') { try { refuse(); } catch (e) {} } return; }
    over = true; document.removeEventListener('keydown', keys, true);
    try { if (typeof sfxKeyClick === 'function') sfxKeyClick('down'); } catch (e) {}
    ctl.close(true); done(n);
  };
  ctl.body.querySelectorAll('.oo-opt').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); choose(+b.dataset.n); }));
  const inp = ctl.body.querySelector('.oo-in input');
  if (inp) {
    inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') submit(); });
    inp.addEventListener('pointerdown', e => e.stopPropagation());
  }
  // The lines type out one after another, each on its own line.
  const lines = [...ctl.body.querySelectorAll('.oo-t')];
  lines.forEach(l => l.classList.add('oo-wait'));
  ctl.typeSound = true;
  (async () => {
    for (const l of lines) { if (over) return; l.classList.remove('oo-wait'); await bsType(l, ctl); l.querySelector('.bs-cur')?.remove(); }
    if (!over && inp) inp.focus();
  })();
}
