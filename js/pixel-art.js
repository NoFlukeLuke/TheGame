// ══════════════════════════════════════════════
// PIXEL ART LOOK (r751, a preview for the owner)
// ══════════════════════════════════════════════
// Everything but the housing drawn as pixel art: `html.px-art` turns on
// css/pixel-art.css. What it does: every word in VT323 with its anti-aliasing
// thresholded away (#pxa-crisp: each pixel fully on or off), hard one-pixel drop
// shadows instead of soft glows, square corners with a stepped pixel notch,
// flat fills dithered in a 2 x 2 checker instead of gradients, images scaled
// with no smoothing, and the cards on the pixel pack (Jfred, r633) for as long
// as the look is on (the stored card face is left alone).
// Turn on: `index.html?pixel`, or dev -> HUD & Display -> Aesthetics -> Pixel art.
// Store `lethe.pixelArt.v1` holds 'on' only.
const PIXEL_ART_KEY = 'lethe.pixelArt.v1';
let pxArtOn = (() => {
  try { return /[?&]pixel\b/.test(location.search) || localStorage.getItem(PIXEL_ART_KEY) === 'on'; }
  catch (e) { return false; }
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
  if (typeof cardFace !== 'undefined' && typeof cardFaceApply === 'function') {
    if (pxArtOn && cardFace !== 'pixel') { _pxArtFace = cardFace; cardFace = 'pixel'; cardFaceApply(); }
    else if (!pxArtOn && _pxArtFace) { cardFace = _pxArtFace; _pxArtFace = null; cardFaceApply(); }
  }
  if (pxArtOn) pxArtFilter();
  const cb = document.getElementById('dev-pixel-art'); if (cb) cb.checked = pxArtOn;
  if (typeof _devSafeRender === 'function') _devSafeRender();
}
function setPixelArt(on) {
  pxArtOn = !!on;
  try { pxArtOn ? localStorage.setItem(PIXEL_ART_KEY, 'on') : localStorage.removeItem(PIXEL_ART_KEY); } catch (e) {}
  pxArtApply();
}
if (document.body) pxArtApply(); else document.addEventListener('DOMContentLoaded', pxArtApply);
