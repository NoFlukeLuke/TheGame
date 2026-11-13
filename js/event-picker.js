// ── THE DECK PICKER (r590; Records' card rows r764) ─────────────────────────
//
// The card selector every card event uses. r764 (owner: "use the card array we
// have in records"): the cards are drawn as Records' Deck tab draws them, every
// physical card with the board's own face (renderCardAppearance, so its buff
// bands, curse and marks show), one row per suit with the suit and its count
// on the left, the row sorted by rank and tucked to fit its width; wilds and
// anything else on rows of their own. About EDP_ROWS_SHOWN rows show and the
// rest scroll (wheel, drag, or the arrows). Pointing at a card (a mouse) lists
// what it carries, as Records does. A pick lifts with a gold ring (and its
// number with opts.ordered). Cards are targets by identity, never by face.
//
// evDeckPicker(parent, opts) -> { picks, sync(), el }
//   opts.cards    the cards to offer (default every deck card)
//   opts.max      how many may be picked (1 replaces the pick)
//   opts.ordered  show 1, 2, 3... on the picks, in the order they were taken
//   opts.blocked(card) -> text, a reason the card cannot be picked (it greys)
//   opts.onChange(picks)
//   opts.locked() -> true while the picker should ignore taps

const EDP_ROWS_SHOWN = 4;

function evDeckPicker(parent, opts) {
  const o = opts || {};
  const cards = (o.cards || everyDeckCard()).filter(Boolean);
  const max = o.max || 1;
  const picks = [];
  const shown = (typeof deckSuitsShown === 'function') ? deckSuitsShown(cards)
    : (typeof ACTIVE_SUITS !== 'undefined' && ACTIVE_SUITS.length ? ACTIVE_SUITS : SUITS);
  const rankIdx = rk => { const i = (typeof ACTIVE_RANKS !== 'undefined' ? ACTIVE_RANKS : []).indexOf(rk); return i < 0 ? 99 : i; };
  const rows = [];
  shown.forEach(st => rows.push({ label: st, cls: suitClass(st), list: cards.filter(c => !isWildCard(c) && c.suit === st) }));
  rows.push({ label: '✶', cls: 'rec-wild', list: cards.filter(c => isWildCard(c)) });
  rows.push({ label: '?', cls: '', list: cards.filter(c => !isWildCard(c) && !shown.includes(c.suit)) });

  const host = document.createElement('div');
  host.className = 'edp edp-rec';
  host.innerHTML = `<div class="edp-wrap"><div class="edp-view"></div>
    <div class="edp-arrows"><button type="button" class="edp-up">▲</button><button type="button" class="edp-dn">▼</button></div></div>`;
  const view = host.querySelector('.edp-view');

  const slotOf = card => {
    const el = document.createElement('div');
    el.className = 'edp-slot';
    const { className, innerHTML } = renderCardAppearance(card, -1, -1, { revealFog: true });
    el.innerHTML = `<div class="${className}">${innerHTML}</div>`;
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
      if (typeof sfxKeyClick === 'function') try { sfxKeyClick('down'); } catch (e) {}
      sync();
      if (o.onChange) o.onChange(picks);
    });
    el.addEventListener('mouseenter', () => {
      if (!matchMedia('(hover: hover)').matches || typeof showEntityTooltip !== 'function') return;
      const lines = (typeof recordsCardLines === 'function') ? recordsCardLines(card) : cardBuffLines(cardId(card), card);
      const why = o.blocked && o.blocked(card);
      if (why) lines.unshift(why);
      showEntityTooltip(el, { label: isWildCard(card) ? 'Wild card' : `${card.rank}${card.suit}`, desc: lines.length ? lines.join('<br>') : 'No buffs.' });
      const rar = document.querySelector('#entity-tip .et-rar');
      if (rar && typeof recordsDeckWhere === 'function') { const w = recordsDeckWhere()(card); rar.textContent = w === 'grid' ? 'ON BOARD' : w === 'played' ? 'PLAYED' : 'IN DECK'; }
    });
    el.addEventListener('mouseleave', () => { if (typeof hideEntityTooltip === 'function') hideEntityTooltip(); });
    return el;
  };
  rows.forEach(rw => {
    if (!rw.list.length) return;
    rw.list.sort((a, b) => rankIdx(a.rank) - rankIdx(b.rank));
    const r = document.createElement('div');
    r.className = 'edp-crow';
    r.innerHTML = `<span class="edp-suit ${rw.cls}">${rw.label}<b>${rw.list.length}</b></span><div class="edp-fan"></div>`;
    const fan = r.querySelector('.edp-fan');
    rw.list.forEach(card => fan.appendChild(slotOf(card)));
    view.appendChild(r);
  });

  // Tuck each row so it fits its width (Records' rule).
  const tuck = () => host.querySelectorAll('.edp-fan').forEach(fan => {
    const n = fan.children.length; if (!n) return;
    const w = fan.children[0].offsetWidth, avail = fan.clientWidth;
    const gap = n > 1 ? Math.min(4, (avail - w) / (n - 1) - w) : 4;
    fan.style.setProperty('--rc-gap', Math.floor(gap) + 'px');
  });

  // Scrolling: the wheel and touch come from overflow; the arrows step one row
  // and repeat while held.
  const rowH = () => (view.querySelector('.edp-crow') || {}).offsetHeight || 60;
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
    view.querySelectorAll('.edp-slot').forEach(el => {
      const at = picks.indexOf(el._card);
      el.classList.toggle('picked', at >= 0);
      el.dataset.n = (o.ordered && at >= 0) ? String(at + 1) : '';
      el.classList.toggle('blocked', !!(o.blocked && o.blocked(el._card)) && at < 0);
    });
  }
  parent.appendChild(host);
  const fit = () => {
    tuck();
    const rh = rowH();
    view.style.maxHeight = (rh * EDP_ROWS_SHOWN + 6) + 'px';
    host.classList.toggle('edp-scrolls', view.scrollHeight > view.clientHeight + 2);
  };
  requestAnimationFrame(fit);
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => tuck()).observe(view);
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
