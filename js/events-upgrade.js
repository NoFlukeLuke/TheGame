// ══════════════════════════════════════════════
// UPGRADE EVENTS (r218) - Trade a Trick · Spin to Improve
// ══════════════════════════════════════════════
// Registered in the four places js/events-core.js requires (pool, handlers,
// EVENT_META, renderers).
//
// "Spin to Improve" rides **js/improve.js** (r206) and knows nothing about any
// individual entity: `ownedImprovable(type)` lists what can still be improved,
// `improvePreview(id)` says what one more step would read as, and
// `improveEntity(id)` applies it. That is also why Knacks are on the wheel here
// - improve.js recomputes BAL in place, so a Knack improves like anything else.

const EV_TIER_ORDER = ['common', 'rare', 'epic', 'legendary'];

// Everything the run owns that improve.js can still improve, across all three
// types, in the shape the wheel draws. Emoji is looked up per type because the
// pools spell it differently (a Trick's comes from trickEmoji).
const EV_KIND_ICON = { trick: '✦', knack: '♦', sleight: '▶' };
function evImprovables() {
  if (typeof ownedImprovable !== 'function') return [];
  const out = [];
  ['trick', 'knack', 'sleight'].forEach(kind => {
    ownedImprovable(kind).forEach(e => {
      const def = (kind === 'trick'   ? TRICK_POOL
                 : kind === 'knack'   ? KNACK_POOL
                 :                      SLEIGHT_POOL).find(x => x.id === e.id);
      out.push({
        kind, id: e.id, name: e.name, rarity: e.rarity,
        emoji: (kind === 'trick' && typeof trickEmoji === 'function' && def) ? trickEmoji(def)
             : (def && def.emoji) || EV_KIND_ICON[kind],
      });
    });
  });
  return out;
}

// Shared draw: a random entity of `kind` at `minTier` or better that the run does
// not already hold. Falls back DOWN the tier ladder rather than returning nothing,
// because an empty-handed conversion would be strictly worse than not playing.
function evDrawEntity(kind, minTier) {
  const floor = Math.max(0, EV_TIER_ORDER.indexOf(minTier));
  const banned = id => (typeof survivalEntityBanned === 'function') && survivalEntityBanned(id);
  let pool;
  if (kind === 'knack') {
    const owned = new Set((acquiredKnacks || []).map(k => k.id));
    pool = KNACK_POOL.filter(k => !owned.has(k.id) && !banned(k.id));
  } else {
    pool = SLEIGHT_POOL.filter(s => !grantedSleightIds.has(s.id)
      && (typeof sleightOfferable !== 'function' || sleightOfferable(s)) && !banned(s.id));
  }
  if (!pool.length) return null;
  // Walk down from the floor tier until something is available.
  for (let t = floor; t >= 0; t--) {
    const at = pool.filter(e => EV_TIER_ORDER.indexOf(e.rarity || 'common') === t);
    if (at.length) return at[Math.floor(Math.random() * at.length)];
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─── EVENT: THE REASSIGNMENT (Trick → Knack or Sleight) ───
// A Trick sits in the tray and scores. A Knack changes a rule; a Sleight is a
// card on the board. Trading one for another is the only way in the game to move
// value BETWEEN those three shapes - which matters most when the tray is full and
// a twelfth Trick would only be a replace-or-decline.
//
// What you get is RANDOM, at the traded Trick's tier or better. Naming the
// replacement would make this a shop; not naming it makes it a trade.
function renderReassignment() {
  const body = document.getElementById('event-body');
  if (typeof trickTray === 'undefined' || !trickTrayMode || !trickTray.length) {
    body.innerHTML = evEmptyHTML('No Tricks to reassign. Take the fee instead.');
    eventState.reassignNone = true;
    setEventConfirm(true); return;
  }
  eventState.reassignTrick = null;
  eventState.reassignKind  = null;
  body.appendChild(evNote('Give up one Trick and it comes back in another form, at its own tier or better. What you get is drawn at random.'));

  const label = evLabel('THE TRICK YOU GIVE UP');
  body.appendChild(label);
  trickTray.forEach(t => {
    const el = makeChoiceEl({
      icon: (typeof trickEmoji === 'function') ? trickEmoji(t) : '✦',
      rarity: t.tier, name: t.name,
      desc: (typeof trickLiveDesc === 'function') ? trickLiveDesc(t) : t.desc,
      onClick: () => {
        body.querySelectorAll('.ev-reassign-trick .event-choice').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected');
        eventState.reassignTrick = t;
        showReassignKinds(t);
        setEventConfirm(!!eventState.reassignKind);
      }
    });
    el.classList.add('ev-reassign-opt');
    const holder = document.createElement('div');
    holder.className = 'ev-reassign-trick';
    holder.appendChild(el);
    body.appendChild(holder);
  });
}

// Rebuilt whenever a different Trick is picked, so the label lives INSIDE the
// removable wrapper - appending it separately stacks a fresh heading every time
// the player changes their mind (the trap The Bench hit in r194).
function showReassignKinds(trick) {
  document.getElementById('ev-reassign-kinds')?.remove();
  eventState.reassignKind = null;
  const body = document.getElementById('event-body');
  const wrap = document.createElement('div');
  wrap.id = 'ev-reassign-kinds';
  wrap.appendChild(evLabel('THE FORM IT COMES BACK AS'));
  [
    { kind:'knack',   icon:'♦', name:'As a Knack',   desc:'A rule change that holds for the whole run. Never drawn, never lost.' },
    { kind:'sleight', icon:'▶', name:'As a Sleight', desc:'A card shuffled into your deck. It falls, swaps and plays like any other.' },
  ].forEach(opt => {
    const preview = evDrawEntity(opt.kind, trick.tier);
    const el = makeChoiceEl({
      icon: opt.icon, rarity: trick.tier, name: opt.name,
      desc: opt.desc + (preview ? '' : ' <b>Nothing left to draw in this form.</b>'),
      onClick: () => {
        if (!preview) return;
        wrap.querySelectorAll('.event-choice').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected');
        eventState.reassignKind = opt.kind;
        setEventConfirm(true);
      }
    });
    if (!preview) el.classList.add('debuff');
    wrap.appendChild(el);
  });
  body.appendChild(wrap);
}

function confirmReassignment() {
  if (eventState.reassignNone) {
    coins += BAL.reassignment.consolation_credits;
    updateCoinsUI?.();
    showMessage(`+${BAL.reassignment.consolation_credits} credits`, 'var(--gold)');
    closeEvent(); return;
  }
  const t = eventState.reassignTrick, kind = eventState.reassignKind;
  if (!t || !kind) { closeEvent(); return; }
  const got = evDrawEntity(kind, t.tier);
  if (!got) { showMessage('Nothing to reassign into', 'var(--cream-dim)'); closeEvent(); return; }
  // Give the Trick up first, so a tray at capacity has room and the deck audit
  // never sees both halves of the trade at once.
  const i = trickTray.findIndex(x => x.id === t.id);
  if (i >= 0) trickTray.splice(i, 1);
  const ai = acquiredTricks.findIndex(x => x.id === t.id);
  if (ai >= 0) acquiredTricks.splice(ai, 1);
  if (typeof renderTrickTray === 'function') renderTrickTray();

  if (kind === 'knack') { acquiredKnacks.push({ ...got }); updateKnackList?.(); }
  else                  { grantSleight(got); }
  showMessage(`${t.name} → ${got.name}`, 'var(--gold)');
  closeEvent();
}

// ─── EVENT: THE DRAW (pick three, the wheel picks one, it improves twice) ───
// The choice is deliberately not "which entity do I improve" - it is "which
// three am I happy with". You stake three and the machine takes one, so the
// interesting decision is how evenly you spread your loadout's value.
const DRAW_PICKS = 3;

function renderDraw() {
  const body = document.getElementById('event-body');
  const ents = evImprovables();
  if (ents.length < 2) {
    body.innerHTML = evEmptyHTML('Not enough Tricks or Sleights to draw between. Take the fee instead.');
    eventState.drawNone = true;
    setEventConfirm(true); return;
  }
  eventState.drawPicked = [];
  eventState.drawEnts   = ents;
  eventState.drawDone   = false;
  const need = Math.min(DRAW_PICKS, ents.length);
  body.appendChild(evNote(`Choose ${need}. The wheel takes one of them at random and improves it <b>twice</b>.`));

  const count = document.createElement('div');
  count.id = 'ev-draw-count';
  count.className = 'ev-label';
  body.appendChild(count);
  const sync = () => {
    count.textContent = `${eventState.drawPicked.length} / ${need} CHOSEN`;
    setEventConfirm(eventState.drawPicked.length === need);
  };

  ents.forEach(ent => {
    // improve.js rewrites the entity's printed desc from BAL, so the preview is
    // the real sentence the player will read afterwards, not a generic promise.
    const tier = (typeof entityTierOf === 'function') ? entityTierOf(ent.id) : 0;
    const prev = (typeof improvePreview === 'function') ? improvePreview(ent.id) : null;
    const el = makeChoiceEl({
      icon: ent.emoji, rarity: ent.rarity,
      name: ent.name + (tier ? ` · improved ×${tier}` : ''),
      desc: prev && prev.after !== prev.before ? prev.after : (prev ? prev.before : ''),
      cost: ent.kind.toUpperCase(),
      onClick: () => {
        if (eventState.drawDone) return;
        const at = eventState.drawPicked.indexOf(ent);
        if (at >= 0) { eventState.drawPicked.splice(at, 1); el.classList.remove('selected'); }
        else if (eventState.drawPicked.length < need) { eventState.drawPicked.push(ent); el.classList.add('selected'); }
        sync();
      }
    });
    body.appendChild(el);
  });
  sync();
}

function confirmDraw() {
  if (eventState.drawNone) {
    coins += BAL.the_draw.consolation_credits;
    updateCoinsUI?.();
    showMessage(`+${BAL.the_draw.consolation_credits} credits`, 'var(--gold)');
    closeEvent(); return;
  }
  // Second press, after the wheel has stopped: leave.
  if (eventState.drawDone) { closeEvent(); return; }
  const picks = eventState.drawPicked || [];
  if (!picks.length) { closeEvent(); return; }
  eventState.drawDone = true;
  setEventConfirm(false);
  document.getElementById('event-skip').style.display = 'none';

  const winner = picks[Math.floor(Math.random() * picks.length)];
  spinDrawWheel(picks, winner, () => {
    // BAL.the_draw.steps improvements, applied one tier at a time - improveEntity
    // is the single step, and it refuses past IMPROVE_MAX_TIER on its own.
    for (let i = 0; i < BAL.the_draw.steps; i++) improveEntity(winner.id);
    const t = (typeof entityTierOf === 'function') ? entityTierOf(winner.id) : 0;
    showMessage(`${winner.name} improved · tier ${t}`, 'var(--gold)');
    const btn = document.getElementById('event-confirm');
    if (btn) { btn.textContent = 'TAKE IT'; btn.disabled = false; }
  });
}

// ─── The wheel ───
// A vertical strip that scrolls past a fixed window and eases to a stop on the
// winner. The winner is decided BEFORE the animation starts and the strip is
// built to land on it - the spin is a presentation of a result, never the thing
// that produces it, so an interrupted or janky animation cannot change what you
// get.
function spinDrawWheel(picks, winner, done) {
  const body = document.getElementById('event-body');
  body.innerHTML = '';
  body.appendChild(evLabel('THE WHEEL'));

  const view = document.createElement('div');
  view.className = 'ev-wheel';
  const strip = document.createElement('div');
  strip.className = 'ev-wheel-strip';

  // Enough repeats that the strip is still moving fast when it passes the early
  // cells, so the slowdown reads as a wheel rather than as a list scrolling.
  const LOOPS = 7;
  const seq = [];
  for (let i = 0; i < LOOPS; i++) picks.forEach(p => seq.push(p));
  seq.push(winner);                        // the cell it stops on
  seq.forEach(ent => {
    const cell = document.createElement('div');
    cell.className = 'ev-wheel-cell rar-' + String(ent.rarity || 'common').toLowerCase();
    cell.innerHTML = `<span class="ewc-icon">${ent.emoji}</span><span class="ewc-name">${ent.name}</span>`;
    strip.appendChild(cell);
  });
  view.appendChild(strip);
  body.appendChild(view);

  const CELL = 58;
  view.style.height = CELL + 'px';
  strip.style.transform = 'translateY(0px)';
  const travel = (seq.length - 1) * CELL;

  // One long ease-out. requestAnimationFrame before setting the end value, or the
  // start and end transforms coalesce into one style recalc and the strip jumps
  // (the same trap js/boss-approach.js documents for the preamble fly-in).
  requestAnimationFrame(() => {
    strip.style.transition = `transform ${BAL.the_draw.spin_ms}ms cubic-bezier(.12,.72,.16,1)`;
    strip.style.transform  = `translateY(${-travel}px)`;
  });
  if (typeof sfxFlipShuffle === 'function') try { sfxFlipShuffle(); } catch (e) {}

  setTimeout(() => {
    view.classList.add('landed');
    if (typeof sfxCoin === 'function') try { sfxCoin(); } catch (e) {}
    body.appendChild(evNote(`<b>${winner.name}</b> improved twice.`));
    done();
  }, BAL.the_draw.spin_ms + 120);
}
