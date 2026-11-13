// ══════════════════════════════════════════════
// CARD FACE (r497) - how a playing card's rank and suit are drawn
// ══════════════════════════════════════════════
// 'print' (default): the printout's pixel type, dot-printed ink on the paper card.
// 'pixel' (r633): Jfred's Pixel Cards (CC0), cut into corner index and centre art
//   (js/data/card-faces.js, tools/cards/build.js); the Joker is the wild card's face.
// Every paper look sits on the pack's blank card (r639, CARD_FACE_STOCK, 9-sliced in css).
// 'phosphor': the card is a small screen, rank and suit glowing in the suit colour.
// 'classic': the old serif face.
// Dev -> HUD & Display -> Aesthetics -> Card face. Store holds only a non-default choice.
const CARD_LOOK_KEY = 'lethe.cardFace.v1';
const CARD_LOOKS = ['print', 'pixel', 'phosphor', 'classic'];
const CARD_LOOK_DEFAULT = 'print';
let cardFace = (() => {
  try { const v = localStorage.getItem(CARD_LOOK_KEY); return CARD_LOOKS.includes(v) ? v : CARD_LOOK_DEFAULT; }
  catch (e) { return CARD_LOOK_DEFAULT; }
})();

// The speckled ink: noise thresholded into a mask, so about a third of each glyph's
// pixels drop out, as a dot-matrix ribbon prints. One shared filter, built once.
function cardFaceFilter() {
  if (document.getElementById('cf-defs')) return;
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.id = 'cf-defs'; s.setAttribute('width', '0'); s.setAttribute('height', '0');
  s.style.cssText = 'position:absolute;width:0;height:0;pointer-events:none';
  s.innerHTML = '<filter id="cf-dot" x="0" y="0" width="100%" height="100%">'
    + '<feTurbulence type="fractalNoise" baseFrequency=".9" result="t"/>'
    + '<feComponentTransfer in="t" result="m"><feFuncA type="discrete" tableValues="0 1 1 1"/></feComponentTransfer>'
    + '<feComposite in="SourceGraphic" in2="m" operator="in"/></filter>';
  document.body.appendChild(s);
}

function cardFaceApply() {
  const h = document.documentElement;
  CARD_LOOKS.forEach(l => h.classList.toggle('cf-' + l, cardFace === l));
  if (cardFace === 'print') cardFaceFilter();
  if (typeof CARD_FACE_STOCK !== 'undefined')   // the blank card under every paper look (r639)
    h.style.setProperty('--cfs-stock', `url("${new URL(CARD_FACE_STOCK, location.href).href}")`);
  if (cardFace === 'pixel' && typeof CARD_FACE_SHEET !== 'undefined') {
    // The sheet and its size, read by css/card-face.css. Absolute: a url() in a custom
    // property resolves against the stylesheet that reads it.
    h.style.setProperty('--cfs', `url("${new URL(CARD_FACE_SHEET, location.href).href}")`);
    h.style.setProperty('--cfs-w', CARD_FACE_SHEET_W); h.style.setProperty('--cfs-h', CARD_FACE_SHEET_H);
    if (!cardFaceApply._warm) { cardFaceApply._warm = new Image(); cardFaceApply._warm.src = CARD_FACE_SHEET; }
  }
  const sel = document.getElementById('dev-card-face'); if (sel) sel.value = cardFace;
}

function setCardFace(v) {
  if (!CARD_LOOKS.includes(v)) return;
  cardFace = v;
  try { v === CARD_LOOK_DEFAULT ? localStorage.removeItem(CARD_LOOK_KEY) : localStorage.setItem(CARD_LOOK_KEY, v); } catch (e) {}
  cardFaceApply();
}

// The sprite pieces for one card face (r633): the centre art, centred, at the source's
// height; the corner index top-left and again rotated bottom-right. Empty when the pixel
// look is off or the pack has no face for this card (a numeric card, a dual card, a
// fogged rank, a six-suit deck's extra suits), which keeps the printed face instead.
function cardFaceSpriteHTML(card, { isWild = false, isNum = false, dual = false, fogged = false } = {}) {
  if (cardFace !== 'pixel' || typeof CARD_FACES === 'undefined' || !card) return '';
  if (isNum || dual || fogged) return '';
  const f = CARD_FACES[isWild ? 'joker' : String(card.suit) + String(card.rank)];
  if (!f) return '';
  const box = (cls, b, extra) => `<div class="pxf ${cls}" style="--x:${b[0]};--y:${b[1]};--w:${b[2]};--h:${b[3]};${extra}"></div>`;
  let h = box('pxf-art', f.a, `--ay:${f.ay}`);
  // The game's card has a 2px border where the pack's has 1px, so the index sits 1 closer.
  if (f.i) { const e = `--ix:${f.ix - 1};--iy:${f.iy - 1}`; h += box('pxf-ix', f.i, e) + box('pxf-ix pxf-br', f.i, e); }
  return h;
}

if (document.body) cardFaceApply(); else document.addEventListener('DOMContentLoaded', cardFaceApply);
