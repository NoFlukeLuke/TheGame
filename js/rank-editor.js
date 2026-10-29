// ══════════════════════════════════════════════
// RANK CONDITIONS AND THE EDITOR (r698)
// ══════════════════════════════════════════════
// Every Trick or Knack whose condition names 3 or fewer fixed ranks (Face Value's
// J/Q/K, Lucky Sevens' 7, 4x4's 4...) reads its ranks from rkSet(id), never a
// literal. The Editor event rechooses them: one entity a visit, the same number of
// ranks it had, for a price. Relative or family conditions (prime, odd/even, highest
// rank, "rank 6 and below") are not listed. The choice lasts while the entity is
// owned (rkPrune drops it when it leaves, so a copy taken again starts fresh).
//
// Improvements read the same set: Inspirato's and Patient Rulers' rolled extra
// ranks are rolled around it and re-rolled if an edit lands on one (rkFixExtras);
// 4x4's 5th improvement adds Queens, or the next face rank when Queens are already
// in the set (rkFourByFourRanks); Cloud Nine adds cards of its current rank.
// `say(desc, R)` rewrites the owned copy's sentence; it runs only once edited.
//
// Feelin Lucky is the one special case (`lucky`): its five ranks are rolled on the
// Trick (`_luckyRanks`). The Editor trades them for RK_LUCKY_PICK (3) chosen ranks,
// for good: `_luckyFixed` stops the sell-to-reroll and keeps it off later Editors.
const RANK_EDIT_DEFS = {
  high_pair:       { ranks: ['2', '4'],        say: (d, R) => d.replace('a 2 or 4', rkOrList(R)) },
  first_light:     { ranks: ['A'],             say: (d, R) => d.replace('Aces score', rkPlList(R) + ' score') },
  wild_heart:      { ranks: ['A'],             say: (d, R) => d.replace('When an Ace', 'When ' + rkOne(R[0])) },
  face_value:      { ranks: ['J', 'Q', 'K'],   say: (d, R) => d.replace('Face cards (J/Q/K)', rkPlList(R)) },
  king_guard:      { ranks: ['K', 'J'],        say: (d, R) => d.replace('Kings and Jacks', rkPlList(R)) },
  men_of_means:    { ranks: ['J', 'Q', 'K'],   say: (d, R) => d.replace('Face cards (J/Q/K)', rkPlList(R)), from: 'face_value' },
  knave_power:     { ranks: ['J'],             say: (d, R) => d.replace('each Jack', 'each ' + rkBare(R[0])) },
  royal_trio:      { ranks: ['K'],             say: (d, R) => d.replace('a King and one other Royal', rkOne(R[0]) + (RK_FACES.includes(R[0]) ? ' and one other Royal' : ' and one Royal')) },
  lucky_sevens:    { ranks: ['7'],             say: (d, R) => d.replace('each 7', 'each ' + rkBare(R[0])) },
  fives_discard:   { ranks: ['5'],             say: (d, R) => d.replace('Each 5', 'Each ' + rkBare(R[0])) },
  tens_mult:       { ranks: ['9'],             say: (d, R) => d.replace('Each 9', 'Each ' + rkBare(R[0])) },
  nines_mult:      { ranks: ['9'],             say: (d, R) => d.replace(/\b9s\b/g, rkPl(R[0])).replace('Each 9', 'Each ' + rkBare(R[0])).replace('A 9 that', rkCap(rkOne(R[0])) + ' that') },
  twos_retrigger:  { ranks: ['2'],             say: (d, R) => d.replace('Each 2', 'Each ' + rkBare(R[0])) },
  eights_retrigger:{ ranks: ['8'],             say: (d, R) => d.replace('scored 8', 'scored ' + rkBare(R[0])).replace('other 8', 'other ' + rkBare(R[0])) },
  aces_absorb:     { ranks: ['A'],             say: (d, R) => d.replace('When an Ace', 'When ' + rkOne(R[0])).replace(/to the Ace\b/, 'to the ' + rkBare(R[0])) },
  ready_set_go:    { ranks: ['3', '6', '9'],   say: (d, R) => d.replace('a 3, 6 or 9', rkOrList(R)) },
  undue_influence: { ranks: ['J', 'Q', 'K'],   say: (d, R) => d.replace('a face card', rkOrList(R)).replace('number of face cards', 'number of those cards') },
  patient_rulers:  { ranks: ['J', 'Q', 'K'],   say: (d, R) => d.replace('face cards', rkPlList(R)) },
  queens_upgrade:  { ranks: ['Q'],             say: (d, R) => d.replace('adjacent to a Queen', 'adjacent to ' + rkOne(R[0])).replace('Queens are', rkPl(R[0]) + ' are') },
  feelin_lucky:    { ranks: [], lucky: true,  say: (d, R) => d.replace(/Five randomly rolled ranks/, rkPlList(R)).replace(/\. Trying to sell this.*$/, '') },
  four_by_four:    { ranks: ['4'], knack: true, say: (d, R) => d.replace('Scored 4s', 'Scored ' + rkPlList(R)).replace(' and Queens', ' and ' + rkPl(rkFourByFourExtra(R))) },
};
// Rolled extra ranks an improvement keeps on the owned copy, by id.
const RK_EXTRA_KEYS = { wild_heart: ['_heartRanks', 'wild_heart'], patient_rulers: ['_prRanks', 'patient_rulers'] };
const RK_FACES = ['J', 'Q', 'K'];
const RK_WORD = { A: 'Ace', J: 'Jack', Q: 'Queen', K: 'King' };
const RK_LUCKY_PICK = 3;

let editorRanks = {};   // id -> ranks chosen at the Editor (SAVE_VARS)

function rkSet(id) {
  const e = editorRanks && editorRanks[id];
  return (e && e.length) ? e : (RANK_EDIT_DEFS[id] ? RANK_EDIT_DEFS[id].ranks : []);
}
function rkHas(id, rank) { return !!rank && rkSet(id).includes(rank); }
function rkEdited(id) { return !!(editorRanks && editorRanks[id] && editorRanks[id].length); }
// What the Editor shows and asks for, per owned entity (Feelin Lucky reads its own Trick).
function rkCur(e) { return RANK_EDIT_DEFS[e.id].lucky ? (e._luckyRanks || []) : rkSet(e.id); }
function rkNeed(e) { return RANK_EDIT_DEFS[e.id].lucky ? RK_LUCKY_PICK : RANK_EDIT_DEFS[e.id].ranks.length; }

// Heads of State: the chosen rank and a face card that is not it.
function rkRoyalTrioMet(cards) {
  const R = rkSet('royal_trio');
  return cards.some(c => R.includes(c.rank)) && cards.some(c => RK_FACES.includes(c.rank) && !R.includes(c.rank));
}
// 4x4's 5th improvement adds Queens; with Queens already chosen it adds the next face rank.
function rkFourByFourExtra(R) {
  return ['Q', 'K', 'J', 'A', '10', '9', '8'].find(r => !R.includes(r)) || 'Q';
}
function rkFourByFourRanks() {
  const R = rkSet('four_by_four');
  return BAL.four_by_four.queens ? [...R, rkFourByFourExtra(R)] : R;
}

// Words. A rank code is 'A', '2'...'10', 'J', 'Q', 'K'.
function rkBare(r) { return RK_WORD[r] || r; }
function rkPl(r) { return RK_WORD[r] ? RK_WORD[r] + 's' : r + 's'; }
function rkOne(r) { return (r === 'A' || r === '8' ? 'an ' : 'a ') + rkBare(r); }
function rkCap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function rkJoin(a, w) { return a.length < 2 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' ' + w + ' ' + a[a.length - 1]; }
function rkPlList(R) { return rkJoin(R.map(rkPl), 'and'); }
function rkOrList(R) { return rkJoin(R.map(rkOne), 'or'); }
function rkShort(R) { return R.map(rkBare).join(' / '); }

// The owned copy's sentence. Called after syncOwnedEntityDescs has put the pool's
// sentence back, and after an edit.
function rkDescApply(e) {
  const def = e && RANK_EDIT_DEFS[e.id];
  if (!def || !e.desc) return;
  if (def.lucky) { if (e._luckyFixed && e._luckyRanks) e.desc = def.say(e.desc, e._luckyRanks); return; }
  if (!rkEdited(e.id)) return;
  e.desc = def.say(e.desc, rkSet(e.id));
}
function rkDescApplyAll() {
  [typeof trickTray !== 'undefined' ? trickTray : [], typeof acquiredTricks !== 'undefined' ? acquiredTricks : [],
   typeof acquiredKnacks !== 'undefined' ? acquiredKnacks : []].forEach(l => (l || []).forEach(rkDescApply));
}

// An edit belongs to the copy you own: drop it once the entity has left.
// Run from renderTrickTray and updateKnackList, which every removal path calls.
function rkPrune() {
  if (!editorRanks) { editorRanks = {}; return; }
  Object.keys(editorRanks).forEach(id => {
    const def = RANK_EDIT_DEFS[id];
    const owned = def && (def.knack ? (typeof hasKnack === 'function' && hasKnack(id))
                                    : (typeof trickTray !== 'undefined' && trickTray.some(t => t && t.id === id)));
    if (!owned) delete editorRanks[id];
  });
}
// A fused Trick takes its part's edit (Men of Means keeps Face Value's ranks).
// Called from selectTrick before anything renders.
function rkOnPickup(trick) {
  const def = trick && RANK_EDIT_DEFS[trick.id];
  if (def && def.from && rkEdited(def.from)) editorRanks[trick.id] = editorRanks[def.from].slice();
  rkDescApply(trick);
}

// Rolled extra ranks never repeat the chosen ones: drop any the edit landed on and roll again.
function rkFixExtras(id) {
  const k = RK_EXTRA_KEYS[id]; if (!k) return;
  const t = typeof ownedTrickObj === 'function' ? ownedTrickObj(id) : null;
  if (!t || !t[k[0]]) return;
  const R = rkSet(id);
  t[k[0]] = t[k[0]].filter(r => !R.includes(r));
  if (typeof rollExtraRanks === 'function') rollExtraRanks(t, k[0], BAL[k[1]].extra_ranks || 0, R);
}
// Cloud Nine lives on its cards: an edit turns up to the number it added of its
// old rank, still unspent in the piles, into the new rank.
function rkMoveCloudNine(from, to) {
  let n = BAL.nines_mult.added || 0, moved = 0;
  [drawPile, playedPile].forEach(p => (p || []).forEach(c => {
    if (moved >= n || !c || c.rank !== from || c._isSleight || c._temp || c._nineSpent || isWildCard(c)) return;
    c.rank = to; moved++;
  }));
  return moved;
}

// ── The event ──
function rkEditables() {
  if (typeof isNumericMode === 'function' && isNumericMode()) return [];
  const out = [];
  (typeof trickTray !== 'undefined' ? trickTray : []).forEach(t => { if (t && RANK_EDIT_DEFS[t.id] && !RANK_EDIT_DEFS[t.id].knack && !t._luckyFixed) out.push({ e: t, kind: 'trick' }); });
  (typeof acquiredKnacks !== 'undefined' ? acquiredKnacks : []).forEach(k => { if (k && RANK_EDIT_DEFS[k.id] && RANK_EDIT_DEFS[k.id].knack) out.push({ e: k, kind: 'knack' }); });
  return out;
}
function rkEditorPrice() { return priceOf(BAL.editor.price); }
function rkEditorRanks() { return (ACTIVE_RANKS || RANKS).filter(r => RANKS.includes(r)); }

function renderEditor() {
  const s = eventState, body = evBodyEl();
  const list = rkEditables(), price = rkEditorPrice();
  s.edPick = null; s.edRanks = [];
  body.appendChild(evLabel('1 · THE ENTITY'));
  const row = document.createElement('div'); row.className = 'ed-ents';
  list.forEach(({ e, kind }) => {
    const rar = ['common', 'rare', 'epic', 'legendary'].includes(e.tier || e.rarity) ? (e.tier || e.rarity) : 'common';
    const el = makeChoiceEl({ rarity: rar, name: e.name, desc: rkShort(rkCur(e)), cls: 'ed-ent',
      tile: { entity: kind, id: e.id, label: e.name, emoji: kind === 'trick' ? trickEmoji(e) : e.emoji },
      onClick: () => {
        row.querySelectorAll('.ed-ent').forEach(x => x.classList.remove('selected'));
        el.classList.add('selected'); s.edPick = e; s.edRanks = RANK_EDIT_DEFS[e.id].lucky ? [] : rkCur(e).slice(); rkEditorPaint();
      } });
    row.appendChild(el);
  });
  body.appendChild(row);
  s.edLabel = evLabel('2 · THE RANKS'); body.appendChild(s.edLabel);
  s.edGrid = document.createElement('div'); s.edGrid.className = 'ed-ranks'; body.appendChild(s.edGrid);
  s.edNote = document.createElement('div'); body.appendChild(s.edNote);
  document.getElementById('event-confirm').textContent = `Edit · ${price} credits`;
  rkEditorPaint();
}
function rkEditorPaint() {
  const s = eventState, e = s.edPick;
  if (!s.edGrid) return;
  s.edGrid.innerHTML = '';
  if (!e) { s.edNote.innerHTML = evNote('Pick a Trick or Knack first.').outerHTML; setEventConfirm(false); return; }
  const need = rkNeed(e);
  s.edLabel.textContent = RANK_EDIT_DEFS[e.id].lucky ? `2 · THE RANKS (PICK ${need}, FIXED FOR GOOD)` : `2 · THE RANKS (PICK ${need})`;
  rkEditorRanks().forEach(r => {
    const b = document.createElement('button'); b.type = 'button';
    b.className = 'ed-rank' + (s.edRanks.includes(r) ? ' on' : '');
    b.textContent = r;
    b.addEventListener('click', () => {
      const i = s.edRanks.indexOf(r);
      if (i >= 0) s.edRanks.splice(i, 1);
      else { if (s.edRanks.length >= need) s.edRanks.shift(); s.edRanks.push(r); }
      rkEditorPaint();
    });
    s.edGrid.appendChild(b);
  });
  const cur = rkCur(e), same = s.edRanks.length === cur.length && s.edRanks.every(r => cur.includes(r));
  const preview = s.edRanks.length === need && !same ? RANK_EDIT_DEFS[e.id].say(rkPoolDesc(e), s.edRanks) : '';
  s.edNote.innerHTML = preview ? evNote(colorizeKeywords(preview)).outerHTML : '';
  setEventConfirm(s.edRanks.length === need && !same && coins >= rkEditorPrice());
}
// The unedited sentence (the pool's, at the current tier), so say() always starts from it.
function rkPoolDesc(e) {
  const pools = [TRICK_POOL, KNACK_POOL, TRICK_POOL_ALL];
  for (const p of pools) { const hit = (p || []).find(x => x.id === e.id); if (hit && hit.desc) return hit.desc; }
  return e.desc || '';
}
function confirmEditor() {
  const s = eventState, e = s.edPick, price = rkEditorPrice();
  if (!e || coins < price) return;
  if (s.edRanks.length !== rkNeed(e)) return;
  const old = rkCur(e).slice();
  coins -= price; updateCoinsUI?.();
  // Kept in the deck's rank order so the sentence reads A, 2... K.
  const R = rkEditorRanks().filter(r => s.edRanks.includes(r));
  if (RANK_EDIT_DEFS[e.id].lucky) {
    e._luckyRanks = R; e._luckyFixed = true;
    syncOwnedEntityDescs();
    noteMessage(`${e.name}: ${rkShort(R)}, fixed`, 'var(--gold)');
    if (typeof renderTrickTray === 'function') renderTrickTray();
    closeEvent();
    return;
  }
  const isDefault = R.length === RANK_EDIT_DEFS[e.id].ranks.length && R.every(r => RANK_EDIT_DEFS[e.id].ranks.includes(r));
  if (isDefault) delete editorRanks[e.id]; else editorRanks[e.id] = R;
  rkFixExtras(e.id);
  if (e.id === 'nines_mult' && old[0] !== R[0]) {
    const n = rkMoveCloudNine(old[0], R[0]);
    if (n) noteMessage(`${n} ${rkPl(old[0])} became ${rkPl(R[0])}`, 'var(--gold)');
  }
  syncOwnedEntityDescs();   // the pool's sentence back on every owned copy, then rkDescApply
  noteMessage(`${e.name}: ${rkShort(R)}`, 'var(--gold)');
  if (typeof renderTrickTray === 'function') renderTrickTray();
  if (typeof updateKnackList === 'function') updateKnackList();
  closeEvent();
}
