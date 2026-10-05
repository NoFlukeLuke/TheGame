// ── THE TRAY LIFT (r409) ─────────────────────────────────────────────────────
// A Trick you point at (mouse) or thumb (finger) lifts out of the tray: it grows,
// rises, and leans a little toward the pointer, following it while it moves.
//
// It is a COPY of the tile, body-level and position:fixed, and that is forced:
// the tray and its list both clip (overflow hidden / overflow-x auto, which clips
// the y axis too), so the real chip can never be drawn past the tray's border.
// The copy is placed in raw viewport px and scaled by the cabinet's zoom, read
// off the untransformed tray rather than the chip - a portrait chip may be
// mid-tilt (r399/r408) and its rect is a perspective box, not its size.
//
// The real chip is only faded while the copy is up, so every system that reads
// or animates it (the r408 tilt cycle and scrub, the dance pop, cooldown rings,
// the tooltip anchor) keeps working on it untouched.
const LIFT_SCALE = 1.22;     // how much bigger the lifted tile is
const LIFT_RISE = 7;         // design px it rises
const LIFT_TILT = 12;        // max degrees it leans toward the pointer
const LIFT_FOLLOW = 4;       // design px it drifts toward the pointer
let _liftGhost = null, _liftChip = null;

function trayLiftEnd() {
  if (_liftChip) _liftChip.classList.remove('tray-lifted');
  _liftChip = null;
  if (_liftGhost) {
    const g = _liftGhost; _liftGhost = null;
    g.classList.remove('up');
    setTimeout(() => g.remove(), 140);
  }
}

function _liftZoom() {
  const area = document.getElementById('trick-tray-area');
  return area && area.offsetWidth ? area.getBoundingClientRect().width / area.offsetWidth : 1;
}

function trayLiftAt(chip, x, y) {
  if (!chip || !chip.isConnected) { trayLiftEnd(); return; }
  if (chip !== _liftChip) {
    trayLiftEnd();
    _liftChip = chip;
    const g = document.createElement('div');
    g.id = 'tray-lift';
    const inner = document.createElement('div');
    inner.className = 'tl-inner';
    const copy = chip.cloneNode(true);
    copy.removeAttribute('id');
    copy.classList.remove('tilt-focus', 'tray-lifted');
    copy.style.cssText = '';
    const cell = chip.querySelector('.reward-cell');
    const cc = copy.querySelector('.reward-cell');
    if (cell && cc) cc.style.padding = getComputedStyle(cell).padding;
    inner.appendChild(copy);
    g.appendChild(inner);
    document.body.appendChild(g);
    _liftGhost = g;
    chip.classList.add('tray-lifted');
    requestAnimationFrame(() => g.classList.add('up'));
  }
  const g = _liftGhost;
  const z = _liftZoom();
  const w = chip.offsetWidth, h = chip.offsetHeight;
  const r = chip.getBoundingClientRect();
  // The left edge and vertical centre survive the r399 tilt (it pivots on the
  // chip's left edge, about its middle), so those two anchor the copy.
  const left = r.left, top = r.top + r.height / 2 - (h * z) / 2;
  g.style.left = left + 'px';
  g.style.top = top + 'px';
  g.style.width = w + 'px';
  g.style.height = h + 'px';
  g.style.transform = `scale(${z})`;
  // Where the pointer sits on the tile, -1..1 each way.
  const cx = left + (w * z) / 2, cy = top + (h * z) / 2;
  let nx = x == null ? 0 : (x - cx) / ((w * z) / 2);
  let ny = y == null ? 0 : (y - cy) / ((h * z) / 2);
  nx = Math.max(-1, Math.min(1, nx)); ny = Math.max(-1, Math.min(1, ny));
  if (document.body.classList.contains('reduced-motion')) { nx = 0; ny = 0; }
  g.style.setProperty('--lx', nx.toFixed(3));
  g.style.setProperty('--ly', ny.toFixed(3));
  g.style.setProperty('--ls', LIFT_SCALE);
  g.style.setProperty('--lr', LIFT_RISE + 'px');
  g.style.setProperty('--lt', LIFT_TILT + 'deg');
  g.style.setProperty('--lf', LIFT_FOLLOW + 'px');
}

// The chip under a point. Later tiles sit on top in a fan, so the LAST chip
// whose box holds x wins; a point past every tile takes the nearest end.
function trayLiftChipAt(list, x, y) {
  // The chip actually drawn under the finger wins (the zigzag stacks two rows);
  // off every tile, the last one whose columns hold x.
  if (y != null) {
    const top = document.elementFromPoint(x, y);
    const c = top && top.closest && top.closest('#trick-tray-list .trick-tray-chip');
    if (c) return c;
  }
  const chips = [...list.querySelectorAll('.trick-tray-chip')];
  let hit = null;
  chips.forEach(c => { const r = c.getBoundingClientRect(); if (x >= r.left && x <= r.right) hit = c; });
  return hit;
}

function trayLiftBind(list) {
  if (!list || list._liftBound) return;
  list._liftBound = true;
  let touching = false;
  list.addEventListener('pointermove', e => {
    if (e.pointerType === 'mouse') {
      const chip = e.target.closest && e.target.closest('.trick-tray-chip');
      if (chip) trayLiftAt(chip, e.clientX, e.clientY); else trayLiftEnd();
      return;
    }
    if (touching) trayLiftAt(trayLiftChipAt(list, e.clientX, e.clientY), e.clientX, e.clientY);
  });
  list.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse') return;
    touching = true;
    trayLiftAt(trayLiftChipAt(list, e.clientX, e.clientY), e.clientX, e.clientY);
  });
  const lift = () => { touching = false; trayLiftEnd(); };
  list.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') lift(); });
  list.addEventListener('pointercancel', lift);
  list.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') trayLiftEnd(); });
}
