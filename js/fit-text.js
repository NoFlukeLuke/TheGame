// ══════════════════════════════════════════════════════════════════════════
// ENTITY NAME FITTING — names must never clip on a tile.
//
// Order of attack, cheapest first:
//   1. Insert SOFT HYPHENS (U+00AD) at syllable breaks in long words. These are
//      invisible unless the browser actually needs to break there, in which case
//      it renders a real hyphen — so "Stimulants" can become "Stimu-lants"
//      instead of being shrunk into unreadability or cut off.
//   2. Shrink the font, half a pixel at a time, until it fits the box.
//
// Step 1 first is deliberate: hyphenating buys a wrap point, which usually costs
// far less legibility than shrinking would. The floor is a real floor — if a name
// still doesn't fit at MIN_PX it is allowed to ellipsise rather than vanish.
// ══════════════════════════════════════════════════════════════════════════

const SHY = '­';

// Rough English syllable breaks. Two classic patterns:
//   VC|CV  — between a pair of consonants flanked by vowels  (stim-u-lant)
//   V|CV   — before a lone consonant between vowels          (fo-cus)
// It only needs to be plausible: a soft hyphen at a slightly odd spot is far
// better than a clipped name, and most breaks never render at all.
function syllableBreaks(w) {
  const isV = c => 'aeiouyAEIOUY'.indexOf(c) >= 0;
  const out = [];
  for (let i = 1; i < w.length - 2; i++) {
    if (isV(w[i - 1]) && !isV(w[i]) && !isV(w[i + 1]) && isV(w[i + 2])) out.push(i + 1);
    else if (isV(w[i - 1]) && !isV(w[i]) && isV(w[i + 1])) out.push(i);
  }
  // Never break within 2 characters of either end — orphaned letters read badly.
  return out.filter(i => i >= 3 && i <= w.length - 3);
}

function hyphenateWord(w) {
  if (w.length < 8 || w.indexOf(SHY) >= 0) return w;
  const brk = syllableBreaks(w);
  if (!brk.length) return w;
  let out = '', prev = 0;
  brk.forEach(i => { out += w.slice(prev, i) + SHY; prev = i; });
  return out + w.slice(prev);
}

// Add soft hyphens to every long word in a string, leaving punctuation alone.
function hyphenateText(text) {
  return String(text == null ? '' : text).replace(/[A-Za-z]{8,}/g, hyphenateWord);
}

// Fit one element's text to its own box.
//   maxLines  — how many lines the box can show (default 2)
//   minPx     — hard floor for the font size (default 6)
// Reads the element's own computed size as the starting point, so each surface
// keeps its designed size when the name already fits.
function fitEntityName(el, { maxLines = 2, minPx = 6 } = {}) {
  if (!el) return;
  // 1. hyphenate (idempotent — SHY chars are skipped on re-run)
  if (!el.dataset.fitDone) {
    const t = el.textContent;
    if (t && /[A-Za-z]{8,}/.test(t)) el.textContent = hyphenateText(t);
    el.dataset.fitDone = '1';
  }
  // 2. shrink until it fits
  el.style.fontSize = '';
  let fs = parseFloat(getComputedStyle(el).fontSize) || 10;
  const overflows = () => {
    const lh = parseFloat(getComputedStyle(el).lineHeight) || fs * 1.15;
    return el.scrollHeight > lh * maxLines + 1 || el.scrollWidth > el.clientWidth + 1;
  };
  let guard = 0;
  while (overflows() && fs > minPx && guard < 48) {
    fs -= 0.5;
    el.style.fontSize = fs + 'px';
    guard++;
  }
}

// Fit every name inside a container. Called after each render of a tile grid.
function fitEntityNames(root, selector, opts) {
  (root || document).querySelectorAll(selector).forEach(el => fitEntityName(el, opts));
}
