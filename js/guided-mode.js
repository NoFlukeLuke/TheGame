// ══════════════════════════════════════════════
// GUIDED MODE (r218) - eight slots an act, and you buy what fills them
// ══════════════════════════════════════════════
// r191's Guided fixed the route: every act ran the same spine, so the Mart was
// guaranteed. That solved the economy problem and removed the decision with it.
// This replaces it. An act is **GUIDED_SLOTS_PER_ACT slots** and then the boss,
// and every slot is filled by one of two kinds of thing:
//
//   - a LEVEL: play a round. Free, and how you earn credits.
//   - a STOP: the Mart, a reward grid, or one of two offered events. Costs
//     credits, and costs the slot.
//
// **The slots are the real currency, not the credits.** Buying power always
// costs a round you will not get to play, so the question an act asks is how
// much of your run you are willing to spend on getting stronger rather than on
// getting further. Credits are only the second constraint.
//
// ── EVERY SLOT ADVANCES THE DIFFICULTY CURVE, BOUGHT OR PLAYED ───────────────
// This is the load-bearing rule and the mode does not work without it. The goal
// curve is driven by `level`, and `level++` lives in triggerLevelUp - which only
// runs when a ROUND starts. So if a bought slot left the curve alone, a player
// could buy six stops and meet the boss at level 2 holding a level-8 loadout.
// That is not a strategy, it is the dominant strategy, and it would be the whole
// mode within one run of finding it.
//
// So guidedAdvanceCurve() bumps `level` when a stop is bought, exactly as
// finishing a round would. The bar you eventually face is set by how far through
// the act you are, never by how you got there - and buying is still worth it,
// because the goal climbs at GOAL_SCALE while base pips climb at only 1.1 and
// the loadout you bought is what covers the difference.

const GUIDED_SLOTS_PER_ACT = 8;
const GUIDED_EVENT_OFFERS  = 2;   // how many events are on the board at once

function guidedActive() { return !!ACTIVE_MODE && ACTIVE_MODE.guided === true; }

// Slots filled this act (0 .. GUIDED_SLOTS_PER_ACT). At the cap, the boss.
let guidedSlot = 0;
// The two events currently for sale, as { id, name, flavor, price }. Rolled once
// per crossroads so the offer is a real decision rather than a fresh gamble each
// time the screen repaints.
let guidedEventOffers = [];
// Set while a bought stop is running, so its close handler knows to come back
// here rather than to the ordinary next-round path.
let guidedInStop = false;

function guidedResetRun() { guidedSlot = 0; guidedEventOffers = []; guidedInStop = false; }

// ── Pricing ─────────────────────────────────────────────────────────────────
// Flat per kind, from BAL.guided. Events are all one price: what separates the
// two on offer is what they DO, and putting different numbers on them made the
// cheaper one read as the worse one.
function guidedStopPrice(kind, id) {
  const B = BAL.guided;
  if (kind === 'shop')   return B.price_shop;
  if (kind === 'reward') return B.price_reward;
  return B.price_event;
}

// ── The act ─────────────────────────────────────────────────────────────────
// Called when whatever filled a slot has finished. One place decides "another
// slot, or the boss", so no caller has to know how long an act is.
function guidedAfterSlot() {
  guidedInStop = false;
  guidedSlot++;
  // Keep the HUD's node pips honest - they read nodeInAct, and the sigil that
  // replaces them on a boss round is driven from the same place.
  nodeInAct = Math.min(5, Math.floor(guidedSlot * 5 / GUIDED_SLOTS_PER_ACT));
  updateActProgressUI?.();
  if (guidedSlot >= GUIDED_SLOTS_PER_ACT) { guidedStartBoss(); return; }
  guidedOpenCrossroads();
}

function guidedStartBoss() {
  nodeInAct = 5;
  updateActProgressUI?.();
  forceBossNextRound = true;
  drainLevelUpQueue();       // deals the round, then triggerLevelUp fires the boss
}

// After the post-boss prize grid. The act rolls over and, per the owner's spec,
// the next act opens ON A LEVEL rather than on the crossroads - an act should
// start by playing, not by shopping.
function guidedAfterPrizeGrid() {
  guidedInStop = false;
  guidedSlot = 0;
  guidedEventOffers = [];
  // Same rollover as the node path, through the one helper (js/quarter.js): it
  // closes the quarter's books, advances, and shows the QUARTER CLOSED card. Two
  // copies of these five lines is exactly how a card ends up on one route only.
  rolloverQuarter(() => drainLevelUpQueue());
}

// Buying a stop costs the same step on the goal curve that finishing a round
// does. See the header - without this the mode has a dominant strategy.
function guidedAdvanceCurve() {
  level++;
  if (typeof goalForLevel === 'function') roundGoal = goalForLevel(level);
  updateScoreUI?.();
}

// ── The crossroads ──────────────────────────────────────────────────────────
function guidedRollEvents() {
  const pool = (typeof EVENT_META !== 'undefined') ? Object.keys(EVENT_META) : [];
  const fresh = pool.filter(id => !(typeof recentEventIds !== 'undefined' && recentEventIds.includes(id)));
  const draw  = (fresh.length >= GUIDED_EVENT_OFFERS) ? fresh : pool;
  const picked = (typeof evShuffle === 'function' ? evShuffle(draw) : draw.slice()).slice(0, GUIDED_EVENT_OFFERS);
  guidedEventOffers = picked.map(id => ({
    id, name: EVENT_META[id].name, flavor: EVENT_META[id].flavor,
    price: guidedStopPrice('event', id),
  }));
}

function guidedOpenCrossroads() {
  if (!guidedEventOffers.length) guidedRollEvents();
  gameTimerPaused = true;
  let el = document.getElementById('guided-crossroads');
  if (!el) {
    el = document.createElement('div');
    el.id = 'guided-crossroads';
    document.body.appendChild(el);
  }
  const left = GUIDED_SLOTS_PER_ACT - guidedSlot;
  // One chip per option. The description is the chip's title rather than a line
  // of its own: a chip has to stay a chip, and the names here already say what
  // the thing is. Events carry their flavour, which is the one case the name
  // alone does not cover.
  const chip = (kind, id, icon, name, desc, price) => {
    const afford = coins >= price;
    return `<button class="gx-chip${afford ? '' : ' locked'}" data-kind="${kind}" data-id="${id || ''}"`
      + `${afford ? '' : ' disabled'} title="${String(desc).replace(/"/g, '&quot;')}">`
      + `<span class="gx-icon">${icon}</span>`
      + `<span class="gx-name">${name}</span>`
      + `<span class="gx-price">${price ? price + ' ◆' : 'FREE'}</span>`
      + `</button>`;
  };
  el.innerHTML = `
    <div class="gx-panel">
      <div class="gx-bar">
        <span class="gx-act">ACT ${actNumber}</span>
        <span class="gx-slots">${guidedSlot} / ${GUIDED_SLOTS_PER_ACT} SLOTS USED</span>
        <span class="gx-coins">${coins} ◆</span>
      </div>
      <div class="gx-note">${left === 1
        ? 'One slot left before the boss.'
        : `${left} slots left before the boss. Everything here costs one of them.`}</div>
      <div class="gx-chips">
        ${chip('level', '', '▶', 'Play a round', 'Clear the goal and take the payout. This is how you earn.', 0)}
        ${chip('shop', '', '🛒', 'The Mart', 'Buy Tricks, Sleights, Knacks and limit upgrades.', guidedStopPrice('shop'))}
        ${chip('reward', '', '▦', 'Reward grid', 'Pick a path across the board and take everything on it.', guidedStopPrice('reward'))}
        ${guidedEventOffers.map(e => chip('event', e.id, '✧', e.name, e.flavor, e.price)).join('')}
      </div>
    </div>`;
  el.querySelectorAll('.gx-chip').forEach(b => {
    b.onclick = () => guidedChoose(b.dataset.kind, b.dataset.id);
  });
  el.classList.add('show');
}

function guidedCloseCrossroads() {
  document.getElementById('guided-crossroads')?.classList.remove('show');
}

function guidedChoose(kind, id) {
  const price = kind === 'level' ? 0 : guidedStopPrice(kind, id);
  if (coins < price) return;
  if (price) { coins -= price; updateCoinsUI?.(); }
  guidedCloseCrossroads();

  if (kind === 'level') {
    // The round itself fills the slot; guidedAfterSlot runs when its payout ends.
    drainLevelUpQueue();
    return;
  }

  // A bought stop costs the same step on the curve a played round would.
  guidedAdvanceCurve();
  guidedInStop = true;
  guidedEventOffers = [];            // re-roll the pair for the next crossroads

  if (kind === 'shop') {
    shopFromNodeFlow  = true;
    nodeFlowAfterShop = () => guidedAfterSlot();
    triggerShop();
  } else if (kind === 'reward') {
    // 'interlude', not a context of its own: that is the only value whose
    // continuation reaches finishInterlude, where the guided return lives.
    // Anything else falls through to the legacy timer path and the grid closes
    // into nothing. guidedInStop is what tells this grid from the prize grid.
    rewardGridContext = 'interlude';
    openRewardGrid();
  } else {
    shopFromNodeFlow = false;
    // Force the drawn event rather than letting openEvent pick - the player just
    // paid for this specific one by name.
    guidedOpenNamedEvent(id, () => guidedAfterSlot());
  }
}

// openEvent draws from its own pool; the crossroads has already chosen. This is
// the same open sequence with the draw replaced, so the no-repeat memory is still
// fed and every other event behaviour is unchanged.
function guidedOpenNamedEvent(id, afterFn) {
  afterEventFn = afterFn || (() => drainLevelUpQueue());
  activeEventId = id;
  recentEventIds.push(id);
  if (recentEventIds.length > EVENT_NO_REPEAT) recentEventIds.shift();
  eventState = {};
  renderEventShell(id);
  document.getElementById('event-overlay').classList.add('show');
}

// The act readout's next stop, for the HUD.
function guidedNextStopLabel() {
  if (!guidedActive()) return '';
  return guidedSlot >= GUIDED_SLOTS_PER_ACT ? 'BOSS'
       : `SLOT ${guidedSlot + 1}/${GUIDED_SLOTS_PER_ACT}`;
}
