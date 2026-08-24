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
let portraitPanelView     = 'knacks';   // what is showing right now
let portraitPanelUserView = 'knacks';   // what the PLAYER chose — restored after an auto-swap

function isPortraitLayout() {
  const st = document.getElementById('stage');
  return !!st && !st.classList.contains('landscape');
}

function setPortraitPanelView(view, opts) {
  const auto = !!(opts && opts.auto);
  view = (view === 'preview') ? 'preview' : 'knacks';
  portraitPanelView = view;
  if (!auto) portraitPanelUserView = view;   // an auto-swap must not overwrite the player's choice
  const st = document.getElementById('stage');
  if (st) { st.classList.toggle('pv-preview', view === 'preview'); st.classList.toggle('pv-knacks', view !== 'preview'); }
  // The chip marquees size themselves from the container's measured width, so a
  // row rendered while its half was hidden (clientWidth 0) never got its
  // auto-scroll. Re-run them for whichever half just became visible.
  if (view === 'knacks' && !_pvRemeasuring && typeof updateKnackList === 'function') {
    _pvRemeasuring = true;
    try { updateKnackList(); } finally { _pvRemeasuring = false; }
  }
  const btn = document.getElementById('panel-swap-btn');
  if (btn) {
    // The button shows where it will take you, not where you are.
    btn.textContent = view === 'preview' ? '◆' : '🂠';
    btn.title = view === 'preview' ? 'Show Knacks' : 'Show hand preview';
    btn.setAttribute('aria-label', btn.title);
  }
}

function togglePortraitPanel() {
  setPortraitPanelView(portraitPanelView === 'preview' ? 'knacks' : 'preview');
}

// The scoring dance draws into the hand preview, so in portrait the preview has
// to be the visible half while it runs — otherwise cards fly to a hidden box.
// flyGridCardToSlot bails out to a plain reveal on a zero-width target, which is
// exactly what used to make portrait scoring look like nothing happened.
function portraitDanceBegin() {
  if (!isPortraitLayout()) return;
  setPortraitPanelView('preview', { auto: true });
}
function portraitDanceEnd() {
  if (!isPortraitLayout()) return;
  setPortraitPanelView(portraitPanelUserView, { auto: true });
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
