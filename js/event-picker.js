// ── THE DECK PICKER (r590) ──────────────────────────────────────────────────
//
// The card selector every card event uses (owner: "scroll through the grid
// organized by suit", the event layouts lab's cut screen, r589): the whole deck
// in one column per suit, a rank to a row from the Ace down, wilds on a last
// row, about six rows in view and the rest a scroll away (wheel, drag, or the
// arrows). A card with buffs wears a gold corner, a cursed one a red corner;
// pointing at it lists what it carries. Two copies of one face sit side by side
// in their cell. Cards are targets by identity, never by face.
//
// evDeckPicker(parent, opts) -> { picks, sync(), el }
//   opts.cards    the cards to offer (default every deck card)
//   opts.max      how many may be picked (1 replaces the pick)
//   opts.ordered  show 1, 2, 3... on the picks, in the order they were taken
//   opts.blocked(card) -> text, a reason the card cannot be picked (it greys)
//   opts.onChange(picks)
//   opts.locked() -> true while the picker should ignore taps

const EDP_ROWS_SHOWN = 6;

function evDeckPicker(parent, opts) {
  const o = opts || {};
  const cards = (o.cards || everyDeckCard()).filter(Boolean);
  const max = o.max || 1;
  const picks = [];
  const suits = [];
  cards.forEach(c => { if (!isWildCard(c) && !suits.includes(c.suit)) suits.push(c.suit); });
  const order = (typeof ACTIVE_SUITS !== 'undefined') ? ACTIVE_SUITS : [];
  suits.sort((a, b) => (order.indexOf(a) + 99) % 99 - (order.indexOf(b) + 99) % 99);
  const val = r => r === 'A' ? 14 : (RANK_ORDER[r] || 0);
  const ranks = [...new Set(cards.filter(c => !isWildCard(c)).map(c => c.rank))].sort((a, b) => val(b) - val(a));
  const wilds = cards.filter(c => isWildCard(c));

  const host = document.createElement('div');
  host.className = 'edp';
  host.style.setProperty('--edp-cols', suits.length || 1);
  const head = `<div class="edp-head">${suits.map(s =>
    `<span class="${['♥', '♦'].includes(s) ? 'red' : ''}">${s}</span>`).join('')}</div>`;
  host.innerHTML = `${head}<div class="edp-wrap"><div class="edp-view"></div>
    <div class="edp-arrows"><button type="button" class="edp-up">▲</button><button type="button" class="edp-dn">▼</button></div></div>`;
  const view = host.querySelector('.edp-view');

  const chip = card => {
    const el = document.createElement('span');
    const k = cardId(card);
    const buffs = (typeof cardBuffLines === 'function') ? cardBuffLines(k, card) : [];
    const curse = cardCurses && cardCurses[k];
    el.className = 'edp-card' + (['♥', '♦'].includes(card.suit) ? ' red' : '')
      + (buffs.length ? ' buffed' : '') + (curse ? ' cursed' : '') + (isWildCard(card) ? ' wild' : '');
    el.textContent = isWildCard(card) ? WILD_RANK : ((typeof cardLabel === 'function') ? cardLabel(card) : `${card.rank}${card.suit}`);
    const tip = [...buffs];
    if (curse && typeof CURSE_DEFS !== 'undefined' && CURSE_DEFS[curse.id]) tip.push(`Cursed: ${CURSE_DEFS[curse.id].name}`);
    if (card.suit2 || card.rank2) tip.push(`Also ${card.rank2 || card.rank}${card.suit2 || card.suit}`);
    if (tip.length) el.title = tip.join('\n');
    el._card = card;
    el.addEventListener('click', () => {
      if (o.locked && o.locked()) return;
      const why = o.blocked && o.blocked(card);
      if (why) { if (typeof refuse === 'function') refuse(why); return; }
      const at = picks.indexOf(card);
      if (at >= 0) picks.splice(at, 1);
      else if (picks.length < max) picks.push(card);
      else if (max === 1) picks.splice(0, 1, card);
      else return;
      sync();
      if (o.onChange) o.onChange(picks);
    });
    return el;
  };
  const row = (list, cls) => {
    const r = document.createElement('div');
    r.className = 'edp-row' + (cls ? ' ' + cls : '');
    list.forEach(cell => {
      const c = document.createElement('div');
      c.className = 'edp-cell' + (cell.length ? '' : ' empty');
      cell.forEach(card => c.appendChild(chip(card)));
      r.appendChild(c);
    });
    view.appendChild(r);
  };
  ranks.forEach(rk => row(suits.map(s => cards.filter(c => !isWildCard(c) && c.rank === rk && c.suit === s))));
  if (wilds.length) {
    const r = document.createElement('div');
    r.className = 'edp-row edp-wilds';
    wilds.forEach(card => r.appendChild(chip(card)));
    view.appendChild(r);
  }

  // Scrolling: the wheel and touch come from overflow; the arrows step one row
  // and repeat while held.
  const rowH = () => (view.querySelector('.edp-row') || {}).offsetHeight || 24;
  const step = d => view.scrollBy({ top: d * rowH(), behavior: 'smooth' });
  let hold = null;
  const press = d => { step(d); clearInterval(hold); hold = setInterval(() => step(d), 180); };
  const release = () => { clearInterval(hold); hold = null; };
  [['.edp-up', -1], ['.edp-dn', 1]].forEach(([sel, d]) => {
    const b = host.querySelector(sel);
    b.addEventListener('pointerdown', e => { e.preventDefault(); press(d); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, release));
  });
  // A mouse drag on the view scrolls it too.
  view.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse') return;
    const drag = { y: e.clientY, top: view.scrollTop, moved: false };
    const move = ev => {
      const z = view.getBoundingClientRect().height / (view.offsetHeight || 1) || 1;
      const dy = (ev.clientY - drag.y) / z;
      if (Math.abs(dy) > 4) drag.moved = true;
      if (drag.moved) view.scrollTop = drag.top - dy;
    };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      if (drag.moved) view.addEventListener('click', ev => ev.stopPropagation(), { capture: true, once: true });
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  });

  function sync() {
    view.querySelectorAll('.edp-card').forEach(el => {
      const at = picks.indexOf(el._card);
      el.classList.toggle('picked', at >= 0);
      el.dataset.n = (o.ordered && at >= 0) ? String(at + 1) : '';
      el.classList.toggle('blocked', !!(o.blocked && o.blocked(el._card)) && at < 0);
    });
  }
  parent.appendChild(host);
  requestAnimationFrame(() => {
    view.style.maxHeight = (rowH() * EDP_ROWS_SHOWN) + 'px';
    host.classList.toggle('edp-scrolls', view.scrollHeight > view.clientHeight + 2);
  });
  sync();
  return { picks, sync, el: host };
}

// Take cards out of the run by identity, wherever they are: the piles or the
// board. Returns how many went. The deck audit follows.
function cutCardsFromDeck(list) {
  let cut = 0;
  (list || []).forEach(card => {
    let i = drawPile.indexOf(card);
    if (i >= 0) { drawPile.splice(i, 1); cut++; return; }
    i = playedPile.indexOf(card);
    if (i >= 0) { playedPile.splice(i, 1); cut++; return; }
    for (let r = 0; r < (gridData || []).length; r++) {
      const c = (gridData[r] || []).indexOf(card);
      if (c >= 0) { gridData[r][c] = null; cut++; return; }
    }
  });
  if (cut) { expectedDeckTotal -= cut; updateDeckHud?.(); }
  return cut;
}
