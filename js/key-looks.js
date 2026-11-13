// ══════════════════════════════════════════════
// KEY LOOK (r662 preview; r670 the owner's pick)
// ══════════════════════════════════════════════
// PLAY, DISCARD and SWAP drawn as small tube screens in a raised rim of the key's own
// colour, with stock shown as little pixel squares instead of bulbs (css/key-looks.css)
// and the words as lit dots (js/key-dots.js). On by default; dev -> HUD & Display ->
// Aesthetics -> Key look turns it off for the old keycaps (stored only when off), or
// index.html?keys=off for one page load. Loads after js/stock-bulbs.js, which asks
// keyLookCfg() where the squares go on a key.
const KL_KEY = 'lethe.keyLook.v1';
const KL_LOOKS = { a: 'tube' };
const KL_DEFAULT = 'a';
// A key's squares: inside the rim (5 design px) with a small margin, a little smaller
// than a bulb.
const KL_SQ = { size: 6, pad: 9 };
// r662 stored a picked look (a / b / c); B and C are gone, so any of them is A now.
let klLook = (() => {
  try {
    const q = new URLSearchParams(location.search).get('keys');
    if (q === 'off' || KL_LOOKS[q]) return q;
    return localStorage.getItem(KL_KEY) === 'off' ? 'off' : KL_DEFAULT;
  } catch (e) { return KL_DEFAULT; }
})();
function keyLookOn() { return !!KL_LOOKS[klLook]; }
function keyLookCfg() { return keyLookOn() ? KL_SQ : null; }
function klApply() {
  const h = document.documentElement;
  h.classList.toggle('kl', keyLookOn());
  Object.keys(KL_LOOKS).forEach(k => h.classList.toggle('kl-' + k, klLook === k));
  const sel = document.getElementById('dev-key-look'); if (sel) sel.value = klLook;
  if (typeof sbApply === 'function') sbApply();
  if (typeof kdApply === 'function') kdApply();
}
function setKeyLook(v) {
  klLook = KL_LOOKS[v] ? v : 'off';
  try { if (keyLookOn()) localStorage.removeItem(KL_KEY); else localStorage.setItem(KL_KEY, 'off'); } catch (e) {}
  klApply();
}
klApply();
