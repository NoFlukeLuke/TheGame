// ══ CLOCK TICK (r499) ═════════════════════════════════════════════════════════
// Every CLOCK_TICK_SEC seconds of a running round the clock gives one gentle swell
// and a quiet tick (pulseClockWithWave, js/clock-fx.js, which stays silent while
// the game is suspended, the clock is frozen or the round is over).
//
// This used to ride the grid heartbeat (r183), a swell that fell down the board
// on the same beat. The owner removed the board swell (r499: the Watch idle look
// gives the board its life now); the tick kept its own timer. The cards' composed
// transform in css/style.css still reads --hbx/--hby/--hbr/--hbs, which nothing
// sets any more, so they sit at their defaults (see CLEANUP.md).
const CLOCK_TICK_SEC = 10;
let _clockTickTimer = null;
function startClockTick() {
  stopClockTick();
  _clockTickTimer = setInterval(() => { if (typeof pulseClockWithWave === 'function') pulseClockWithWave(); }, CLOCK_TICK_SEC * 1000);
}
function stopClockTick() { if (_clockTickTimer) clearInterval(_clockTickTimer); _clockTickTimer = null; }
// The old heartbeat's stored settings are dead.
try { localStorage.removeItem('hbCfg3'); localStorage.removeItem('hbEnabled'); } catch (e) {}
