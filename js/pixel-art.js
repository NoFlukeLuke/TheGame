// ══════════════════════════════════════════════
// PIXEL ART LOOK (r751, a preview for the owner)
// ══════════════════════════════════════════════
// Everything but the housing drawn as pixel art: `html.px-art` turns on
// css/pixel-art.css. What it does: every word in VT323 with its anti-aliasing
// thresholded away (#pxa-crisp: each pixel fully on or off), hard one-pixel drop
// shadows instead of soft glows, square corners with a stepped pixel notch,
// flat fills dithered in a 2 x 2 checker instead of gradients, images scaled
// with no smoothing, and the cards' rank and suit built square by square like the
// keys' words (r757: the 5x7 letter grid of js/key-dots.js, suits drawn on the same
// grid), on a black or a darkish off-white card (`pxArtCards`), for as long as the
// look is on (the stored card face is left alone).
// Turn on: `index.html?pixel`, or dev -> HUD & Display -> Aesthetics -> Pixel art.
// Store `lethe.pixelArt.v1` holds 'on' only; `lethe.pixelArtCards.v1` holds 'dark' only
// (the card background; off-white otherwise). `?pixel=dark` picks it for one page load.
const PIXEL_ART_KEY = 'lethe.pixelArt.v1';
let pxArtOn = (() => {
  try { return /[?&]pixel\b/.test(location.search) || localStorage.getItem(PIXEL_ART_KEY) === 'on'; }
  catch (e) { return false; }
})();
const PIXEL_CARDS_KEY = 'lethe.pixelArtCards.v1';
let pxArtCards = (() => {
  try { const m = /[?&]pixel=(dark|paper)\b/.exec(location.search); return m ? m[1] : (localStorage.getItem(PIXEL_CARDS_KEY) === 'dark' ? 'dark' : 'paper'); }
  catch (e) { return 'paper'; }
})();
let _pxArtFace = null;   // the card face to give back when the look goes off

function pxArtFilter() {
  if (document.getElementById('pxa-svg')) return;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = 'pxa-svg'; svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  svg.innerHTML = `<filter id="pxa-crisp" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
    <feComponentTransfer><feFuncA type="discrete" tableValues="0 1"/></feComponentTransfer></filter>`;
  document.body.appendChild(svg);
}

function pxArtApply() {
  document.documentElement.classList.toggle('px-art', pxArtOn);
  document.documentElement.classList.toggle('pxa-dark', pxArtOn && pxArtCards === 'dark');
  if (typeof cardFace !== 'undefined' && typeof cardFaceApply === 'function') {
    if (pxArtOn && cardFace !== 'print') { _pxArtFace = cardFace; cardFace = 'print'; cardFaceApply(); }
    else if (!pxArtOn && _pxArtFace) { cardFace = _pxArtFace; _pxArtFace = null; cardFaceApply(); }
  }
  if (pxArtOn) pxArtFilter();
  const cb = document.getElementById('dev-pixel-art'); if (cb) cb.checked = pxArtOn;
  const cs = document.getElementById('dev-pixel-cards'); if (cs) cs.value = pxArtCards;
  if (typeof _devSafeRender === 'function') _devSafeRender();
}
function setPixelArt(on) {
  pxArtOn = !!on;
  try { pxArtOn ? localStorage.setItem(PIXEL_ART_KEY, 'on') : localStorage.removeItem(PIXEL_ART_KEY); } catch (e) {}
  pxArtApply();
}
function setPixelArtCards(v) {
  pxArtCards = v === 'dark' ? 'dark' : 'paper';
  try { pxArtCards === 'dark' ? localStorage.setItem(PIXEL_CARDS_KEY, 'dark') : localStorage.removeItem(PIXEL_CARDS_KEY); } catch (e) {}
  pxArtApply();
}

// ── The card face, square by square (r757, owner: "do the cards like the buttons") ──
// The rank is the keys' 5x7 letter grid (kdGlyph, js/key-dots.js); the suits are drawn
// on a 7x7 grid here. One SVG per face, one rect per lit square, a gap round each, in
// the suit's colour (css/pixel-art.css section 6 sets the colour and the glow).
const PXA_SUITS = {
  '\u2665': '.xx.xx. xxxxxxx xxxxxxx xxxxxxx .xxxxx. ..xxx.. ...x...',
  '\u2666': '...x... ..xxx.. .xxxxx. xxxxxxx .xxxxx. ..xxx.. ...x...',
  '\u2660': '...x... ..xxx.. .xxxxx. xxxxxxx xx.x.xx ...x... ..xxx..',
  '\u2663': '..xxx.. ..xxx.. xx.x.xx xxxxxxx xx.x.xx ...x... ..xxx..',
  '\u2736': 'x..x..x .x.x.x. ..xxx.. xxxxxxx ..xxx.. .x.x.x. x..x..x',
};
const _pxaGrid = src => src.split(' ').map(r => [...r].map(c => c === 'x'));
function pxArtFaceHTML(card, { isWild = false, isNum = false, dual = false, fogged = false } = {}) {
  if (!pxArtOn || !card || isNum || dual || typeof kdGlyph !== 'function') return '';
  const suitSrc = PXA_SUITS[isWild ? WILD_RANK : card.suit];
  if (!suitSrc) return '';   // a six-suit deck's extra suits keep the printed face
  const word = isWild ? 'WILD' : fogged ? '?' : String(card.rank);
  const glyphs = [...word].map(ch => kdGlyph(7, ch)).filter(Boolean);
  if (!glyphs.length) return '';
  const rw = glyphs.reduce((w, g) => w + g.w, 0) + glyphs.length - 1;
  const suit = _pxaGrid(suitSrc), sw = 7, gap = 2;
  const W = Math.max(rw, sw), H = 7 + gap + suit.length;
  let rects = '';
  const sq = (x, y) => { rects += `<rect x="${x + .1}" y="${y + .1}" width=".8" height=".8"/>`; };
  let x = (W - rw) / 2;
  glyphs.forEach(g => { g.rows.forEach((row, ry) => row.forEach((on, rx) => { if (on) sq(x + rx, ry); })); x += g.w + 1; });
  const sx = (W - sw) / 2;
  suit.forEach((row, ry) => row.forEach((on, rx) => { if (on) sq(sx + rx, 7 + gap + ry); }));
  return `<svg class="pxa-face${word.length > 2 ? ' pxa-long' : ''}" viewBox="-.5 -.5 ${W + 1} ${H + 1}" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
}

if (document.body) pxArtApply(); else document.addEventListener('DOMContentLoaded', pxArtApply);
