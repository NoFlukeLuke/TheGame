// ══════════════════════════════════════════════
// GUIDED MODE (r191) - Classic with the route decided for you
// ══════════════════════════════════════════════
// In Classic the reward grid carries a DESTINATION tile, and what comes after a
// round is whatever the player routed themselves to. That is a real decision,
// but it means a run can go a long stretch with no shop - which matters a lot in
// a game where a run has to close a 1.227x-per-level gap out of its loadout (see
// "Natural Scaling" in CLAUDE.md). Guided fixes the rotation instead: every act
// runs the same legible spine, so the economy is guaranteed and the player can
// see what is coming.
//
// THE SPINE IS THIS TABLE. Index = the node whose reward grid just closed, value
// = what happens between that grid and the next round. Changing the shape of a
// Guided act is editing these two lines and nothing else.
const GUIDED_ACT_FLOW  = ['shop', 'event', 'shop', 'event', null];  // nodes 0-4; node 4 leads to the boss
const GUIDED_POST_BOSS = ['event', 'event'];                        // after the prize grid, before the next act

function guidedActive() { return !!ACTIVE_MODE && ACTIVE_MODE.guided === true; }

// What follows the reward grid of `node`. Node 5 is the post-boss prize grid.
function guidedStopsAfterNode(node) {
  if (node === 5) return GUIDED_POST_BOSS.slice();
  const stop = GUIDED_ACT_FLOW[node];
  return stop ? [stop] : [];
}

// Run a list of stops in order, then `done`. Each stop hands control to a screen
// that closes on its own schedule, so this is a callback chain rather than a
// loop - openEvent already takes a continuation, and the shop reports back
// through resumeAfterNodeFlowShop (js/reward-grid.js).
function guidedRunStops(stops, done) {
  let i = 0;
  const open = (stop) => {
    if (stop === 'shop') {
      shopFromNodeFlow = true;
      nodeFlowAfterShop = next;
      triggerShop();
    } else if (stop === 'event') {
      shopFromNodeFlow = false;
      openEvent(next);
    } else {
      next();
    }
  };
  // A beat between stops. The event overlay closes and reopens on the same
  // element, so the post-boss event pair would otherwise hard-cut from one
  // straight into the next and read as a glitch. The FIRST stop is not delayed -
  // that transition already exists in Classic and is timed against the grid.
  const next = () => {
    if (i >= stops.length) { done(); return; }
    const stop = stops[i];
    if (i++ === 0) open(stop);
    else setTimeout(() => open(stop), 280);
  };
  next();
}

// The next stop, for the act readout - so the spine is visible from the HUD
// rather than only being discoverable by playing it.
function guidedNextStopLabel() {
  if (!guidedActive()) return '';
  if (nodeInAct === 5) return 'BOSS';
  const stop = GUIDED_ACT_FLOW[nodeInAct];
  return stop === 'shop' ? 'MART' : stop === 'event' ? 'EVENT' : (nodeInAct === 4 ? 'BOSS' : '');
}
