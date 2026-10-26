// ══════════════════════════════════════════════
// KEY LOOKS (r662, owner's brief) - a preview to choose from
// ══════════════════════════════════════════════
// PLAY, DISCARD and SWAP drawn as small pixelated screens in a raised rim of the key's
// own colour, with stock shown as little pixel squares instead of bulbs. Three looks
// (css/key-looks.css): A tube, B lcd, C pixel. Off = today's keycaps.
// Dev -> HUD & Display -> Aesthetics -> Key look (stored), or index.html?keys=a|b|c
// for one page load (not stored). Loads after js/stock-bulbs.js, which asks
// keyLookCfg() where the squares go on a key.
const KL_KEY = 'lethe.keyLook.v1';
const KL_LOOKS = { a: 'tube', b: 'lcd', c: 'pixel' };
// A key's squares: inside the rim (5 design px) with a small margin, a little smaller
// than a bulb.
const KL_SQ = { size: 6, pad: 9 };
let klLook = (() => {
  try {
    const q = new URLSearchParams(location.search).get('keys');
    if (q && KL_LOOKS[q]) return q;
    const v = localStorage.getItem(KL_KEY);
    return KL_LOOKS[v] ? v : 'off';
  } catch (e) { return 'off'; }
})();
function keyLookOn() { return !!KL_LOOKS[klLook]; }
function keyLookCfg() { return keyLookOn() ? KL_SQ : null; }
function klApply() {
  const h = document.documentElement;
  h.classList.toggle('kl', keyLookOn());
  Object.keys(KL_LOOKS).forEach(k => h.classList.toggle('kl-' + k, klLook === k));
  const sel = document.getElementById('dev-key-look'); if (sel) sel.value = klLook;
  if (typeof sbApply === 'function') sbApply();
}
function setKeyLook(v) {
  klLook = KL_LOOKS[v] ? v : 'off';
  try { if (keyLookOn()) localStorage.setItem(KL_KEY, klLook); else localStorage.removeItem(KL_KEY); } catch (e) {}
  klApply();
}
klApply();
