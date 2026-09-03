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
// dance - fly-in, card beats, score climb - ran in a zero-size invisible box.
// Measured: #selected-cards was 0×0 with .dnc-active set and children inside.
//
// ── How the swap is applied ──
// A class on #stage (`pv-knacks` / `pv-preview`) drives it, and the CSS carries
// `!important` because it has to beat that inline `display:none`. Every rule is
// scoped `#stage:not(.landscape)`, which is what keeps it out of landscape's way
// - those selectors simply stop matching once `.landscape` is on, so there is no
// specificity race with the landscape block.

let _pvRemeasuring        = false;  // guards the re-measure below from re-entering
// The Trick tray keeps its own half of the strip and is ALWAYS visible; only
// Knacks and the hand preview share the other half (r160 - an earlier pass made
// all three take turns, which hid the Tricks the player needs at a glance).
// Tricks that don't fit their half FAN over each other instead - see
// fanTrickTray() in js/tricks-ui.js.
const PORTRAIT_VIEWS = ['knacks', 'preview'];
let portraitPanelView     = 'knacks';   // what is showing right now
let portraitPanelUserView = 'knacks';   // what the PLAYER chose - restored after an auto-swap

function isPortraitLayout() {
  const st = document.getElementById('stage');
  return !!st && !st.classList.contains('landscape');
}

const _PV_NEXT_LABEL = { knacks: '🂠', preview: '♦' };
const _PV_NEXT_TITLE = { knacks: 'Show hand preview', preview: 'Show Knacks' };

function setPortraitPanelView(view, opts) {
  const auto = !!(opts && opts.auto);
  if (!PORTRAIT_VIEWS.includes(view)) view = 'knacks';
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
      if (view === 'knacks' && typeof updateKnackList === 'function') updateKnackList();
    } finally { _pvRemeasuring = false; }
  }
  const btn = document.getElementById('panel-swap-btn');
  if (btn) {
    // The button shows where it will take you, not where you are.
    btn.textContent = _PV_NEXT_LABEL[view] || '🂠';
    btn.title = _PV_NEXT_TITLE[view] || 'Swap panel';
    btn.setAttribute('aria-label', btn.title);
  }
}

function togglePortraitPanel() {
  const i = PORTRAIT_VIEWS.indexOf(portraitPanelView);
  setPortraitPanelView(PORTRAIT_VIEWS[(i + 1) % PORTRAIT_VIEWS.length]);
}

// The scoring dance draws into the hand preview, so in portrait the preview has
// to be the visible half while it runs - otherwise cards fly to a hidden box.
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


// The Trick tray is always on screen now, so a granted Trick needs no view
// switch - it only needs the fan re-measured, which renderTrickTray does.
function portraitShowTricks() { /* no-op: Tricks is never hidden behind the swap */ }

// ══════════════════════════════════════════════
// PORTRAIT PREVIEW CARD SIZING  (r160)
// ══════════════════════════════════════════════
// The portrait preview drew its cards at a fixed 30×40 - under half the height of
// the strip they sit in, and unreadably small on a phone. They are now sized to
// the strip at run time.
//
// Two constraints have to be satisfied at once, which is why this is measured JS
// and not a static --card-w/--card-h:
//   1. VERTICAL - a card should fill ~80% of the strip's height.
//   2. HORIZONTAL - the whole hand has to fit the preview's half of the strip,
//      with `edgePad` of clear space at each end.
// A five-card hand at 80% height cannot fit side by side in that half, so the
// cards overlap. But overlap has a floor: a card whose visible sliver is narrower
// than `minVisibleFrac` of itself shows none of its centred rank/suit, which
// would be a worse readout than the small cards were. So the card is sized DOWN
// from the 80% ideal until the row can hold it at that minimum - three cards get
// nearly the full 80%, five cards land smaller but still well above the old 40px.
//
// One uniform mechanism does both spacings: `step` is the pitch from one card's
// left edge to the next, and the margin between them is `step - w`. Positive is a
// real gap (the hand fits); negative is overlap.
const PORTRAIT_PREVIEW_CFG = {
  vFill:          0.80,    // card height as a share of the strip's height
  aspect:         38 / 50, // w : h - the same proportion as a grid card
  edgePad:        3,       // px of clear space at each end of the row
  gap:            4,       // px between cards when they fit without overlapping
  minVisibleFrac: 0.55,    // least of each overlapped card that must stay showing
  minW:           30,      // never end up smaller than the old fixed size
};

function fitPortraitPreviewCards() {
  const stage = document.getElementById('selected-cards');
  if (!stage) return;
  // Landscape has its own anchored box with fixed card sizing - clear anything
  // this left behind (orientation can change mid-run) and stay out of the way.
  if (!isPortraitLayout()) {
    stage.style.removeProperty('--card-w');
    stage.style.removeProperty('--card-h');
    stage.style.removeProperty('--dnc-lap');
    return;
  }
  // Only the scoring dance fills this box in portrait. The shop's cost readout
  // borrows the same slot and must not be re-sized.
  if (!stage.classList.contains('dnc-active')) return;
  const track = stage.querySelector('.dnc-row.hand .dnc-track');
  const items = stage.querySelector('.dnc-row.hand .dnc-items');
  if (!track || !items) return;
  const n = track.querySelectorAll('.dnc-outer').length;
  if (!n) return;

  const cfg   = PORTRAIT_PREVIEW_CFG;
  const strip = document.getElementById('trick-panel');
  const stripH = strip ? strip.clientHeight : 92;
  const avail  = items.clientWidth - cfg.edgePad * 2;
  if (stripH < 10 || avail < 20) return;               // not laid out yet

  // Widest card the row can hold with every card at least minVisibleFrac visible.
  const wByWidth  = avail / (1 + (n - 1) * cfg.minVisibleFrac);
  const wByHeight = stripH * cfg.vFill * cfg.aspect;
  const w = Math.max(cfg.minW, Math.floor(Math.min(wByWidth, wByHeight)));
  const h = Math.round(w / cfg.aspect);

  // Pitch between cards: as much as the row affords, capped at a normal gap.
  const step = (n > 1) ? Math.min(Math.floor((avail - w) / (n - 1)), w + cfg.gap) : 0;
  stage.style.setProperty('--card-w', w + 'px');
  stage.style.setProperty('--card-h', h + 'px');
  stage.style.setProperty('--dnc-lap', (n > 1 ? step - w : 0) + 'px');
}
