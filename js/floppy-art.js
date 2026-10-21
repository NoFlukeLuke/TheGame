// ══════════════════════════════════════════════
// FLOPPY ART (r593) - the owner's own picture of the Trick's floppy disc
// ══════════════════════════════════════════════
// A Trick is drawn as a floppy disc in CSS (css/style.css, `.reward-cell.entity-trick`).
// A PNG uploaded to assets/art/floppy/ takes the drawn disc's place: one per rarity
// (common.png, rare.png, epic.png, legendary.png), and floppy.png for any rarity that
// has none of its own. The Trick's icon still sits on the label, where the drawn disc
// has it (assets/art/floppy/README.md gives the size and the label's box).
// Nothing lists what was uploaded, so the five files are asked for once at load;
// each one found sets `--fa-<rarity>` and `html.fa-<rarity>`, which the stylesheet
// reads. A missing file is one quiet request and changes nothing.
// Art 128px wide or smaller is pixel art and is drawn without smoothing (`html.fa-pix`).
// Dev -> HUD & Display -> Aesthetics -> Floppy art switches back to the drawn disc
// (`lethe.floppyArt.v1`, stored only when off).
const FLOPPY_ART_DIR = 'assets/art/floppy/';
const FLOPPY_ART_TIERS = ['common', 'rare', 'epic', 'legendary'];
const FLOPPY_ART_FALLBACK = 'floppy';
const FLOPPY_ART_PIXEL_MAX = 128;
const FLOPPY_ART_KEY = 'lethe.floppyArt.v1';
let floppyArtOn = (() => { try { return localStorage.getItem(FLOPPY_ART_KEY) !== 'off'; } catch (e) { return true; } })();
let floppyArtFound = null;   // { name: widthPx } once the probe is done
let floppyArtRatio = {};     // { name: width / height }
// The art's drawn box inside the drawn disc's 20:19 box (`contain`), as a background
// size. The improvement bands are laid over THAT box (r610), so they sit on the art's
// own bottom-left corner instead of in the empty strip beside a narrower picture.
function floppyArtBandBox(r) {
  return r <= 20 / 19 ? `${(95 * r).toFixed(2)}% 100%` : `100% ${(100 / (0.95 * r)).toFixed(2)}%`;
}

function floppyArtApply() {
  const h = document.documentElement;
  const found = floppyArtFound || {};
  let pix = false;
  FLOPPY_ART_TIERS.forEach(t => {
    const name = found[t] ? t : (found[FLOPPY_ART_FALLBACK] ? FLOPPY_ART_FALLBACK : null);
    const on = floppyArtOn && !!name;
    h.classList.toggle('fa-' + t, on);
    if (on) {
      h.style.setProperty('--fa-' + t, `url("${new URL(FLOPPY_ART_DIR + name + '.png', location.href).href}")`);   // absolute, as --px-sheet
      h.style.setProperty('--fa-' + t + '-bs', floppyArtBandBox(floppyArtRatio[name] || 20 / 19));
      if (found[name] <= FLOPPY_ART_PIXEL_MAX) pix = true;
    } else { h.style.removeProperty('--fa-' + t); h.style.removeProperty('--fa-' + t + '-bs'); }
  });
  h.classList.toggle('fa-pix', pix);
  const sel = document.getElementById('dev-floppy-art');
  if (sel) {
    sel.value = floppyArtOn ? 'yours' : 'drawn';
    const n = Object.keys(found).length;
    const note = document.getElementById('dev-floppy-art-found');
    if (note) note.textContent = floppyArtFound ? (n ? `${n} file${n === 1 ? '' : 's'} found` : 'no files uploaded') : 'looking...';
  }
}

function setFloppyArt(v) {
  floppyArtOn = v !== 'drawn';
  try { floppyArtOn ? localStorage.removeItem(FLOPPY_ART_KEY) : localStorage.setItem(FLOPPY_ART_KEY, 'off'); } catch (e) {}
  floppyArtApply();
}

(function floppyArtProbe() {
  const names = [...FLOPPY_ART_TIERS, FLOPPY_ART_FALLBACK], found = {};
  let left = names.length;
  const done = () => { if (--left === 0) { floppyArtFound = found; floppyArtApply(); } };
  names.forEach(name => {
    const img = new Image();
    img.onload = () => { found[name] = img.naturalWidth; floppyArtRatio[name] = img.naturalWidth / img.naturalHeight; done(); };
    img.onerror = done;
    img.src = FLOPPY_ART_DIR + name + '.png';
  });
})();
