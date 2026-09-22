// ══════════════════════════════════════════════════════════════════════════
// ENTITY NAME FITTING - names must never clip, and must never break mid-word.
//
// The rule (r182, owner's report): "The Heron" was rendering as
//
//     the
//     hero
//     n
//
// because the tile let the browser break inside a word (overflow-wrap:break-word)
// and the fitter only ever checked HEIGHT - three short lines fit three allowed
// lines, so it never shrank anything. A name split across a letter is unreadable
// no matter how many lines it fits in.
//
// So: WORDS ARE ATOMIC. Wrapping happens at spaces only. The fitter measures the
// widest single word and shrinks the font until that word fits the tile on one
// line, then keeps shrinking if the wrapped result is still too tall. "The Heron"
// becomes "THE / HERON" at a slightly smaller size instead of nonsense.
//
// Soft hyphens are gone with the old approach. They were only ever there to buy a
// break point inside a word, which is exactly what we no longer want.
// ══════════════════════════════════════════════════════════════════════════

// One offscreen canvas for every measurement. Canvas text metrics are exact and,
// unlike a DOM probe, cost no layout - which matters because a shelf of 12 tiles
// re-fits on every render.
let _fitCtx = null;
function fitCtx() {
  if (!_fitCtx) _fitCtx = document.createElement('canvas').getContext('2d');
  return _fitCtx;
}

// ── EMOJI INK NORMALISATION (r292) ─────────────────────────────────────────
// AN EMOJI'S INK IS NOT ITS FONT-SIZE, and that is the whole bug behind "the
// emojis stick out". Measured across all 95 entity glyphs in Noto Color Emoji,
// every colour glyph paints an ink box of 1.25 x 1.18 em - so a glyph set at
// 30px paints 35px tall, and a box sized for 30px is overflowed by 9% at the
// top and 9% at the bottom. On the Trick disc that is the emoji climbing over
// the metal shutter and sitting on its own name (measured: ink 1.22x its box).
//
// Scaling by EMOJI_INK_EM/inkRatio makes FONT-SIZE MEAN INK HEIGHT: every glyph
// paints the same fraction of an em whatever it is, so the boxes in
// css/style.css are sized against the picture rather than against an em box the
// picture ignores. It also makes the odd one out consistent - a
// text-presentation symbol like the fallback star measures 0.77 em and is
// scaled UP to match the emoji, instead of drawing 40% smaller than its
// neighbours.
//
// THE CORRECTION IS A PURE FUNCTION OF THE GLYPH, which is what makes this
// cheap: it needs no DOM and no layout, so entityTileInner can measure it while
// building a string and stamp it into the markup, and every surface that draws
// a tile gets it with no per-surface wiring.
//
// VERTICAL CENTRING NEEDS NO CORRECTION and was measured rather than assumed:
// with `line-height: 1` the half-leading is symmetric, so the line box's centre
// IS the font box's centre, and the ink centre sits within 0.005 em of it for
// every colour emoji (0.03 em for the two text symbols). The flex centring the
// tiles already do is therefore correct; only the size was wrong.
const EMOJI_PROBE_PX = 100;
const EMOJI_PROBE_FONT = "'Cinzel', serif";   // what .rwd-art computes to
// HOW MUCH OF THE EM THE INK IS ALLOWED TO PAINT, and the one knob worth
// tuning here. At 1.0 the ink exactly fills the box it is centred in, which on
// the Trick disc means touching the label's top edge and the top of its own
// name; 0.86 leaves that margin and still reads as a full-size picture. Chosen
// by rendering 1.0 / 0.92 / 0.86 / 0.80 side by side over the real disc art.
//
// It also absorbs a measurement error that cannot be removed: Noto Color Emoji
// is a BITMAP font, so ink does not scale perfectly linearly with font-size and
// a glyph probed at 100px lands ~3% out at the 34-119px the game draws at.
const EMOJI_INK_EM = 0.86;
// A glyph may not paint more than a little over its em box or less than half of
// it: a measurement that lands outside this is a font we do not understand, and
// leaving such a glyph alone beats scaling it by a number we cannot trust.
const EMOJI_SCALE_MIN = 0.6, EMOJI_SCALE_MAX = 1.6;
const _emojiScale = new Map();

function emojiInkScale(glyph, family) {
  if (!glyph) return 1;
  const key = glyph + '|' + (family || '');
  if (_emojiScale.has(key)) return _emojiScale.get(key);
  let s = 1;
  try {
    const ctx = fitCtx();
    ctx.font = `${EMOJI_PROBE_PX}px ${family || EMOJI_PROBE_FONT}`;
    const m = ctx.measureText(glyph);
    const ink = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
    if (ink > 0) s = Math.min(EMOJI_SCALE_MAX, Math.max(EMOJI_SCALE_MIN,
                    EMOJI_INK_EM * EMOJI_PROBE_PX / ink));
  } catch (e) { s = 1; }
  s = Math.round(s * 1000) / 1000;
  _emojiScale.set(key, s);
  return s;
}

// Cinzel is a WEBFONT, so a text-presentation glyph measured before it loads is
// measured in the fallback serif. Colour emoji come from a system font and are
// right on the first measurement, which is why this is a cache clear and not a
// re-render: the values that can move are the rare ones.
if (typeof document !== 'undefined' && document.fonts && document.fonts.ready)
  document.fonts.ready.then(() => _emojiScale.clear(), () => {});

// Width of one word at `px`, honouring the element's own font, weight,
// letter-spacing and text-transform - a tile that renders UPPERCASE with 0.4px
// tracking is meaningfully wider than the raw string suggests.
function measureWordPx(word, px, cs) {
  const ctx = fitCtx();
  ctx.font = `${cs.fontStyle || 'normal'} ${cs.fontWeight || 400} ${px}px ${cs.fontFamily || 'sans-serif'}`;
  let t = word;
  if (cs.textTransform === 'uppercase') t = t.toUpperCase();
  else if (cs.textTransform === 'lowercase') t = t.toLowerCase();
  else if (cs.textTransform === 'capitalize') t = t.replace(/\b\w/g, ch => ch.toUpperCase());
  // letter-spacing lands BETWEEN characters as far as the visible advance goes -
  // counting a trailing one made an 8-character name measure ~0.4px wider than
  // the browser actually laid it out, which was enough to truncate a name that
  // fit perfectly ("Overtime" → "Overti…").
  const ls = parseFloat(cs.letterSpacing) || 0;
  return ctx.measureText(t).width + ls * Math.max(0, t.length - 1);
}

// Canvas metrics and layout rounding never agree to the last fraction of a
// pixel, so a name is "too wide" only when it is over by a visible amount.
const FIT_SLOP = 0.75;

// ── SEAL THE PUNCTUATION BREAKS ────────────────────────────────────────────
// `word-break: keep-all` stops a browser breaking mid-letter, but it does NOT
// stop the break opportunities punctuation creates: Chromium will happily split
// "Swaps/Round" after the slash, and a hyphenated name after the hyphen. That is
// the same class of bad break as "hero / n" - and worse, the fitter measures
// those strings as ONE word, so it sizes them for a line the browser then breaks
// anyway.
//
// U+2060 WORD JOINER on both sides of the offending character forbids the break
// without printing anything or adding any width, so the rendered line breaks
// exactly where the measurement said it would: at spaces, and nowhere else.
const WJ = '\u2060';
function sealBreaks(text) {
  return text.replace(/([\/\-\u2013\u2014\u2010\u00b7])/g, WJ + '$1' + WJ);
}

// Usable inner width: clientWidth already excludes the border but still includes
// the element's own horizontal padding.
function innerWidthOf(el, cs) {
  const pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
  return Math.max(0, el.clientWidth - pad);
}

// Fit one element's text to its own box.
//   maxLines  - how many lines the box can show (default 2)
//   minPx     - hard floor for the font size (default 6)
// Reads the element's own computed size as the starting point, so each surface
// keeps its designed size when the name already fits.
function fitEntityName(el, { maxLines = 2, minPx = 6 } = {}) {
  if (!el) return;
  // Undo any previous fit so re-renders start from the CSS-designed size rather
  // than compounding shrink on shrink.
  el.style.fontSize = '';

  // IDEMPOTENT. Step 3 can rewrite the text (truncating a word to an ellipsis),
  // so the pristine name is stashed on first run and restored on every later one
  // - otherwise a second fit would truncate the already-truncated string, and a
  // name would erode a little further each re-render.
  if (el.dataset.fitSrc == null) el.dataset.fitSrc = (el.textContent || '').trim();
  let text = sealBreaks(el.dataset.fitSrc);
  if (!text) return;
  if (el.textContent !== text) el.textContent = text;

  const cs = getComputedStyle(el);
  const avail = innerWidthOf(el, cs);
  if (avail <= 0) return;                       // not laid out yet - nothing to measure against

  const base = parseFloat(cs.fontSize) || 10;
  let fs = base;

  // ── 1. width pass: the LONGEST WORD must fit on one line ──
  // Solved directly rather than by looping: text width scales linearly with font
  // size, so one division gives the size that fits. Rounded down to the half
  // pixel so sizes stay tidy and identical names always land on the same size.
  const words = text.split(/\s+/).filter(Boolean);
  let widest = 0;
  words.forEach(w => { widest = Math.max(widest, measureWordPx(w, base, cs)); });
  if (widest > avail + FIT_SLOP) {
    fs = Math.floor((base * avail / widest) * 2) / 2;
    fs = Math.max(minPx, Math.min(base, fs));
    // Verify rather than trust the division: rounding to the half pixel can land
    // a hair over, and being a hair over is what triggers truncation below.
    let g0 = 0;
    while (fs > minPx && g0 < 40 &&
           words.some(w => measureWordPx(w, fs, cs) > avail + FIT_SLOP)) { fs -= 0.5; g0++; }
    el.style.fontSize = fs + 'px';
  }

  // ── 2. height pass: the wrapped result must fit maxLines ──
  // Half a pixel at a time from wherever the width pass left off.
  const overflowsHeight = () => {
    const lh = parseFloat(getComputedStyle(el).lineHeight) || fs * 1.15;
    return el.scrollHeight > lh * maxLines + 1;
  };
  let guard = 0;
  while (overflowsHeight() && fs > minPx && guard < 60) {
    fs -= 0.5;
    el.style.fontSize = fs + 'px';
    guard++;
  }

  // ── 3. last resort: TRUNCATE, never split ──
  // Some tiles are genuinely too small for some names - "Kaleidoscope" in a 47px
  // tray chip cannot be legible at any size that fits. The old fallback let the
  // browser break inside the word, which is the exact thing being fixed here, so
  // instead the WORD is shortened and given an ellipsis: "KALEIDOSC…". That reads
  // as "there is more of this name", which is true, and the full name is one tap
  // away in the tooltip. Multi-word names still wrap at their spaces as normal,
  // so "Middle Management" stays two whole words.
  const stillTooWide = words.some(w => measureWordPx(w, fs, cs) > avail + FIT_SLOP);
  if (stillTooWide) {
    el.textContent = words.map(w => truncateToWidth(w, fs, cs, avail)).join(' ');
    // Truncating may have freed a line; the height rule still has to hold.
    let g2 = 0;
    while (overflowsHeight() && fs > minPx && g2 < 60) { fs -= 0.5; el.style.fontSize = fs + 'px'; g2++; }
  }
}

// Longest prefix of `word` that fits `avail` with an ellipsis appended. Falls
// back to a bare ellipsis if not even one character fits.
function truncateToWidth(word, fs, cs, avail) {
  if (measureWordPx(word, fs, cs) <= avail + FIT_SLOP) return word;
  const ELL = '\u2026';
  for (let n = word.length - 1; n > 0; n--) {
    const t = word.slice(0, n) + ELL;
    if (measureWordPx(t, fs, cs) <= avail) return t;
  }
  return ELL;
}

// Fit every name inside a container. Called after each render of a tile grid.
function fitEntityNames(root, selector, opts) {
  (root || document).querySelectorAll(selector).forEach(el => fitEntityName(el, opts));
}
