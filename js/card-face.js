// ══════════════════════════════════════════════
// CARD FACE (r497) - how a playing card's rank and suit are drawn
// ══════════════════════════════════════════════
// 'print' (default): the printout's pixel type, dot-printed ink on the paper card.
// 'phosphor': the card is a small screen, rank and suit glowing in the suit colour.
// 'classic': the old serif face.
// Dev -> HUD & Display -> Aesthetics -> Card face. Store holds only a non-default choice.
const CARD_LOOK_KEY = 'lethe.cardFace.v1';
const CARD_LOOKS = ['print', 'phosphor', 'classic'];
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
  const sel = document.getElementById('dev-card-face'); if (sel) sel.value = cardFace;
}

function setCardFace(v) {
  if (!CARD_LOOKS.includes(v)) return;
  cardFace = v;
  try { v === CARD_LOOK_DEFAULT ? localStorage.removeItem(CARD_LOOK_KEY) : localStorage.setItem(CARD_LOOK_KEY, v); } catch (e) {}
  cardFaceApply();
}

if (document.body) cardFaceApply(); else document.addEventListener('DOMContentLoaded', cardFaceApply);
