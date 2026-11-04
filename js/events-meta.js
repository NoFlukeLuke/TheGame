// ══ META EVENTS (r706, owner) ════════════════════════════════════════════════
// Two events that work on the collection rather than the run:
//
//   LICENSING  sells a Trick's UNLOCK for credits. TRICK_UNLOCKS rows with
//              `buy: 1` (js/data/unlocks.js) can only be unlocked here. Several
//              may be bought at once; the price is BAL.licensing per tier.
//   LORE       scheduled, never drawn: every LORE_EVERY-th event opened (all
//              modes, all sources, a lifetime count) is replaced by it while
//              LORE_ORDER has a legendary left to offer; after that, 1% of any
//              event. It types `?`, takes one word, types the answer (js/data/
//              lore.js), then offers that visit's legendary: Take or Leave. The
//              legendary is offered whether or not it is unlocked: this is the
//              way they are found.
//
// The event counter lives here (`lethe.eventLog.v1`: n opened, lore index).
// openEvent and guidedOpenNamedEvent ask evmScheduled(id) for the id to open.

const EVM_KEY = 'lethe.eventLog.v1';
const LORE_EVERY = 50;
const LORE_LATE_CHANCE = 0.01;
let evmForceLore = false;   // dev -> Tools -> Trick unlocks: the next event opened is the lore event
let evmLog = (() => { try { return JSON.parse(localStorage.getItem(EVM_KEY) || '{}') || {}; } catch (e) { return {}; } })();
evmLog.n = evmLog.n || 0; evmLog.lore = evmLog.lore || 0;
function evmSave() { try { localStorage.setItem(EVM_KEY, JSON.stringify(evmLog)); } catch (e) {} }

// The legendaries the lore event still has to offer, in order.
function loreQueue() {
  if (typeof LORE_ORDER === 'undefined' || typeof TRICK_POOL_ALL === 'undefined') return [];
  return LORE_ORDER.slice(evmLog.lore).filter(id => TRICK_POOL_ALL.some(t => t.id === id && t.tier === 'legendary' && !t.retired));
}
// The legendary this lore visit offers: the next in order, else (all offered) one
// you do not hold.
function loreLegendary() {
  const q = loreQueue();
  if (q.length) return TRICK_POOL_ALL.find(t => t.id === q[0]);
  const free = TRICK_POOL_ALL.filter(t => t.tier === 'legendary' && !t.retired && !t.fused && !(typeof hasTrick === 'function' && hasTrick(t.id)));
  return free.length ? free[Math.floor(Math.random() * free.length)] : null;
}

// Every opened event passes through here: it is counted, and the scheduled one
// takes its place. Paused in the tours and labs (they open events for testing).
function evmScheduled(id) {
  if (typeof unlockPaused === 'function' && unlockPaused()) return id;
  evmLog.n++; evmSave();
  if (typeof ulBump === 'function') ulBump('events');
  const due = evmForceLore || (loreQueue().length ? (evmLog.n % LORE_EVERY === 0) : Math.random() < LORE_LATE_CHANCE);
  evmForceLore = false;
  if (due && loreLegendary()) return 'lore';
  return id;
}

// ── LICENSING ───────────────────────────────────────────────────────────────
function licensePrice(def) { return priceOf((BAL.licensing && BAL.licensing[def.tier]) || BAL.licensing.rare); }
function licenseOffers() {
  if (typeof TRICK_UNLOCKS === 'undefined' || typeof TRICK_POOL_ALL === 'undefined') return [];
  return TRICK_POOL_ALL.filter(t => TRICK_UNLOCKS[t.id] && TRICK_UNLOCKS[t.id].buy && trickLocked(t.id));
}
function licensingEligible() {
  const o = licenseOffers();
  return o.length > 0 && o.some(t => coins >= licensePrice(t));
}
function renderLicensing() {
  const s = eventState;
  s.licOffers = evShuffle(licenseOffers()).slice(0, 3);
  s.licPicked = new Set();
  const body = document.getElementById('event-body');
  body.appendChild(evLabel('BUY A LICENSE · ANY NUMBER'));
  s.licOffers.forEach(def => {
    const price = licensePrice(def);
    const name = (typeof shownEntityName === 'function') ? shownEntityName(def, 'trick') : def.name;
    const el = makeChoiceEl({ rarity: def.tier, name, desc: def.desc, cost: `${price} credits`,
      tile: { entity: 'trick', id: def.id, emoji: trickEmoji(def), label: name },
      onClick: () => {
        if (s.licPicked.has(def.id)) { s.licPicked.delete(def.id); el.classList.remove('selected'); }
        else {
          const total = [...s.licPicked].reduce((n, id) => n + licensePrice(TRICK_POOL_ALL.find(t => t.id === id)), 0) + price;
          if (total > coins) { if (typeof refuse === 'function') refuse('Not enough credits'); return; }
          s.licPicked.add(def.id); el.classList.add('selected');
        }
        licensingSync();
      } });
    if (coins < price) el.classList.add('locked');
    body.appendChild(el);
  });
  s.licNote = evNote('');
  body.appendChild(s.licNote);
  licensingSync();
}
function licensingSync() {
  const s = eventState;
  const total = [...s.licPicked].reduce((n, id) => n + licensePrice(TRICK_POOL_ALL.find(t => t.id === id)), 0);
  if (s.licNote) s.licNote.textContent = s.licPicked.size ? `${s.licPicked.size} license${s.licPicked.size > 1 ? 's' : ''} · ${total} credits` : '';
  setEventConfirm(s.licPicked.size > 0 && total <= coins);
}
function confirmLicensing() {
  const s = eventState;
  const ids = [...(s.licPicked || [])];
  const total = ids.reduce((n, id) => n + licensePrice(TRICK_POOL_ALL.find(t => t.id === id)), 0);
  if (!ids.length || total > coins) { closeEvent(); return; }
  coins -= total; if (typeof updateCoinsUI === 'function') updateCoinsUI();
  ids.forEach(id => unlockTrick(id));
  closeEvent();
}

// ── LORE ────────────────────────────────────────────────────────────────────
function loreAnswer(word) {
  const w = String(word || '').trim().toLowerCase().replace(/[^a-z0-9' -]/g, '');
  if (!w) return LORE_FALLBACK;
  for (const k in LORE_ANSWERS) if (k.split('|').includes(w)) return LORE_ANSWERS[k];
  return LORE_FALLBACK;
}
function renderLore() {
  const s = eventState;
  s.loreDef = loreLegendary();
  s.loreAsked = false;
  const body = document.getElementById('event-body');
  const term = document.createElement('div');
  term.className = 'lore-term';
  term.innerHTML = `<div class="lore-line"><span class="lore-q">&gt;</span><input class="lore-in" type="text" maxlength="24" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="One word"></div><div class="lore-out"></div>`;
  body.appendChild(term);
  s.loreTerm = term;
  const inp = term.querySelector('.lore-in');
  // The game's own keys (PLAY, DISCARD, Escape...) must not fire while typing.
  ['keydown', 'keyup', 'keypress'].forEach(t => inp.addEventListener(t, e => {
    e.stopPropagation();
    if (t === 'keydown' && e.key === 'Enter') { e.preventDefault(); loreAsk(inp.value); }
  }));
  setTimeout(() => { try { inp.focus(); } catch (e) {} }, 60);
  document.getElementById('event-confirm').textContent = 'Take';
  document.getElementById('event-skip').textContent = 'Leave';
}
async function loreAsk(word) {
  const s = eventState;
  if (s.loreAsked || activeEventId !== 'lore') return;
  s.loreAsked = true;
  const inp = s.loreTerm.querySelector('.lore-in');
  inp.disabled = true;
  const out = s.loreTerm.querySelector('.lore-out');
  const text = loreAnswer(word);
  // types at the game's text speed (Settings -> Display -> Text speed)
  const cps = (typeof textTypeCps === 'function') ? textTypeCps() : 160;
  const line = document.createElement('div'); line.className = 'lore-ans'; out.appendChild(line);
  if (cps > 0) {
    for (const ch of text) {
      if (activeEventId !== 'lore') return;
      line.textContent += ch;
      if (ch !== ' ') await new Promise(r => setTimeout(r, 1000 / cps));
    }
  } else line.textContent = text;
  if (activeEventId !== 'lore') return;
  const def = s.loreDef;
  if (!def) { setEventConfirm(true); return; }
  const nm = (typeof shownEntityName === 'function') ? shownEntityName(def, 'trick') : def.name;
  const el = makeChoiceEl({ rarity: def.tier, name: nm, desc: def.desc,
    tile: { entity: 'trick', id: def.id, emoji: trickEmoji(def), label: nm } });
  el.classList.add('selected', 'lore-offer');
  out.appendChild(el);
  if (typeof evReveal === 'function') evReveal(el);
  setEventConfirm(true);
}
// Take or Leave, the visit is spent: the next scheduled lore event offers the next legendary.
function loreSpend() {
  const s = eventState;
  if (s.loreSpent) return;
  s.loreSpent = true;
  if (s.loreDef && LORE_ORDER[evmLog.lore] === s.loreDef.id) { evmLog.lore++; evmSave(); }
}
function confirmLore() {
  const s = eventState;
  const def = s.loreDef;
  if (def && s.loreAsked) {
    if (typeof trickTrayFullFor === 'function' && trickTrayFullFor(def.id)) { if (typeof refuseTrickCapacity === 'function') refuseTrickCapacity(); return; }
    if (typeof unlockTrick === 'function') unlockTrick(def.id, true);
    injectTrickAfterReward({ ...def });
  }
  loreSpend();
  closeEvent();
}

// ── dev ─────────────────────────────────────────────────────────────────────
function devSyncUnlocks() {
  const a = document.getElementById('dev-unlock-all'); if (a) a.checked = !!unlockAllDev;
  const m = document.getElementById('dev-meta-legend'); if (m) m.checked = metaFlag('legendary_find');
  const n = document.getElementById('dev-unlock-count');
  if (n) n.textContent = `${collectionLine()} · events ${evmLog.n} · lore ${evmLog.lore} / ${LORE_ORDER.length}${evmForceLore ? ' · lore next' : ''}`;
}
