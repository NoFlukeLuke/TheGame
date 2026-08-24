// ══════════════════════════════════════════════
// PORTRAIT SHARED PANEL  (r156)
// ══════════════════════════════════════════════
// Portrait has one narrow strip (#trick-panel) to hold three things that all
// want room: the Trick tray, the Knacks row, and the hand preview. Landscape
// gives each its own anchored box; portrait cannot. So in portrait the Knacks
// row and the hand preview SHARE the right-hand half and a small button swaps
// between them.
//
// Before this, portrait simply had no hand preview at all: syncTrickTrayUI()
// sets `#hand-preview-area { display:none }` inline whenever Tricks live in the
// tray (the default), and only landscape overrode it. The scoring dance renders
// into #selected-cards inside that hidden element, so in portrait the ENTIRE
// dance — fly-in, card beats, score climb — ran in a zero-size invisible box.
// Measured: #selected-cards was 0×0 with .dnc-active set and children inside.
//
// ── How the swap is applied ──
// A class on #stage (`pv-knacks` / `pv-preview`) drives it, and the CSS carries
// `!important` because it has to beat that inline `display:none`. Every rule is
// scoped `#stage:not(.landscape)`, which is what keeps it out of landscape's way
// — those selectors simply stop matching once `.landscape` is on, so there is no
// specificity race with the landscape block.

let _pvRemeasuring        = false;  // guards the re-measure below from re-entering
// Three views share the strip now (r159): Tricks joined Knacks and the hand
// preview, so each gets the FULL width and can be drawn much larger.
const PORTRAIT_VIEWS = ['tricks', 'knacks', 'preview'];
let portraitPanelView     = 'tricks';   // what is showing right now
let portraitPanelUserView = 'tricks';   // what the PLAYER chose — restored after an auto-swap

function isPortraitLayout() {
  const st = document.getElementById('stage');
  return !!st && !st.classList.contains('landscape');
}

const _PV_NEXT_LABEL = { tricks: '♦', knacks: '🂠', preview: '✦' };
const _PV_NEXT_TITLE = { tricks: 'Show Knacks', knacks: 'Show hand preview', preview: 'Show Tricks' };

function setPortraitPanelView(view, opts) {
  const auto = !!(opts && opts.auto);
  if (!PORTRAIT_VIEWS.includes(view)) view = 'tricks';
  portraitPanelView = view;
  if (!auto) portraitPanelUserView = view;   // an auto-swap must not overwrite the player's choice
  const st = document.getElementById('stage');
  if (st) PORTRAIT_VIEWS.forEach(v => st.classList.toggle('pv-' + v, v === view));
  // The chip marquees size themselves from the container's measured width, so a
  // row rendered while its view was hidden (clientWidth 0) never got its
  // auto-scroll. Re-run whichever one just became visible.
  if (!_pvRemeasuring) {
    _pvRemeasuring = true;
    try {
      if (view === 'knacks' && typeof updateKnackList  === 'function') updateKnackList();
      if (view === 'tricks' && typeof renderTrickTray  === 'function') renderTrickTray();
    } finally { _pvRemeasuring = false; }
  }
  const btn = document.getElementById('panel-swap-btn');
  if (btn) {
    // The button shows where it will take you, not where you are.
    btn.textContent = _PV_NEXT_LABEL[view] || '♦';
    btn.title = _PV_NEXT_TITLE[view] || 'Swap panel';
    btn.setAttribute('aria-label', btn.title);
  }
}

function togglePortraitPanel() {
  const i = PORTRAIT_VIEWS.indexOf(portraitPanelView);
  setPortraitPanelView(PORTRAIT_VIEWS[(i + 1) % PORTRAIT_VIEWS.length]);
}

// The scoring dance draws into the hand preview, so in portrait the preview has
// to be the visible half while it runs — otherwise cards fly to a hidden box.
// flyGridCardToSlot bails out to a plain reveal on a zero-width target, which is
// exactly what used to make portrait scoring look like nothing happened.
let _pvBeforeDance = null;
function portraitDanceBegin() {
  if (!isPortraitLayout()) return;
  // Restore to whatever was ACTUALLY showing, not to the last manual choice: a
  // Knack granted just before the hand auto-surfaced Knacks, and bouncing to
  // Tricks afterwards because that was the last thing the player picked reads
  // as a glitch.
  if (portraitPanelView !== 'preview') _pvBeforeDance = portraitPanelView;
  setPortraitPanelView('preview', { auto: true });
}
function portraitDanceEnd() {
  if (!isPortraitLayout()) return;
  setPortraitPanelView(_pvBeforeDance || portraitPanelUserView, { auto: true });
  _pvBeforeDance = null;
}

// Knacks are granted between rounds (reward grid, Mart, survival picks). If the
// player has the preview showing, flip back so the new Knack lands somewhere
// visible rather than behind the swap.
function portraitShowKnacks() {
  if (!isPortraitLayout()) return;
  setPortraitPanelView('knacks', { auto: true });
}

// Orientation can change mid-run (a tablet being turned). Re-assert the class so
// the portrait strip is in a sane state when coming back from landscape.
function syncPortraitPanel() {
  setPortraitPanelView(portraitPanelUserView, { auto: true });
}


// Gaining a Trick surfaces the Tricks view, the same way a granted Knack
// surfaces Knacks — otherwise the new Trick lands behind the swap.
function portraitShowTricks() {
  if (!isPortraitLayout()) return;
  setPortraitPanelView('tricks', { auto: true });
}
