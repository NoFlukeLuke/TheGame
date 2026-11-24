// ══════════════════════════════════════════════
// CORNERS (r820, owner) - one rule for every rounded corner in the game
// ══════════════════════════════════════════════
// Console mode (`html.skin-machine`): every rounded corner is a pixel step, a square
// notch `CORNERS.notch` px (design px) deep: `corner-shape: notch` cuts it, and the
// border, background and shadows follow the cut. A browser without corner-shape gets
// square corners. Outside console mode (`html.tray-flat`): every rounded corner is
// rounded slightly, `CORNERS.round` px (a smaller radius stays as it was).
// How: at load (and when a stylesheet is added) every style rule in the game's
// stylesheets that rounds a corner is read, and an override is written for it under
// each look, inside the same @media / @supports, with `!important` and the same
// selector one class stronger, so it beats the rule it copies. Circles and pills
// (a corner at 25% or more, or 50px or more) are left round. Cards keep their own
// corners (the stock's steps, r639 / r762), and the dev panel is left alone.
// A new rounded corner needs nothing: it is picked up from its stylesheet. A corner
// set from JS (an inline style) is not.
// r834 (owner): console corners are plain squares (notch 0, no corner-shape); r820's 3px notch is gone.
const CORNERS = { notch: 0, round: 4 };

function _cornerKind(v) {
  v = (v || '').trim();
  if (!v || v === 'initial' || v === 'unset') return 'zero';
  if (v === 'inherit') return 'inherit';
  if (/var\(|calc\(|min\(|max\(|clamp\(/.test(v)) return 'skip';
  const parts = v.split(/\s+/);   // "6px" or "6px 4px" (elliptical)
  let big = false, any = false;
  for (const p of parts) {
    const m = /^(-?[\d.]+)(px|%|em|rem)?$/.exec(p);
    if (!m) return 'skip';
    const n = parseFloat(m[1]), u = m[2] || 'px';
    if (n <= 0) continue;
    any = true;
    if (u === '%' ? n >= 25 : (u === 'px' ? n : n * 16) >= 50) big = true;
  }
  if (!any) return 'zero';
  return big ? 'round' : 'corner';
}
function _cornerPx(v) {
  const m = /^(-?[\d.]+)(px|em|rem)?/.exec((v || '').trim());
  if (!m) return CORNERS.round;
  return parseFloat(m[1]) * (m[2] && m[2] !== 'px' ? 16 : 1);
}
const _CORNER_PROPS = ['border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius'];

// One selector list -> the override selectors for one look, pseudo-elements kept outside :is().
function _cornerSel(selText, look) {
  const out = [];
  // split on top-level commas only
  let depth = 0, cur = '';
  for (const ch of selText) {
    if (ch === '(') depth++; else if (ch === ')') depth--;
    if (ch === ',' && !depth) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim()).filter(Boolean).map(s => {
    const m = /(::?(?:before|after|placeholder|marker|selection|-webkit-[\w-]+))$/.exec(s);
    const pseudo = m ? m[1] : '';
    const base = (pseudo ? s.slice(0, -pseudo.length) : s).trim() || '*';
    return `html.${look}.${look} :is(${base}):not(.card)${pseudo}`;
  }).join(',\n');
}

function _cornerRule(rule) {
  const st = rule.style;
  const sel = rule.selectorText || '';
  if (!sel || /dev-panel|#dev-|\.dev-|cf-lab|ca-lab/.test(sel)) return null;
  const vals = _CORNER_PROPS.map(p => st.getPropertyValue(p));
  const short = st.getPropertyValue('border-radius');
  if (!vals.some(Boolean) && !short) return null;
  const kinds = vals.map(_cornerKind);
  if (!vals.some(Boolean) && short) return null;   // a shorthand with var(): unknown, left alone
  if (kinds.includes('skip') || kinds.includes('round')) return null;
  if (kinds.every(k => k === 'zero')) return null;
  if (kinds.includes('inherit')) {
    // a layer that takes its box's corners (a screen's glass dome): the shape follows too
    return null;   // r834: square boxes, nothing to inherit
  }
  let con = '', flat = '';
  _CORNER_PROPS.forEach((p, i) => {
    if (kinds[i] !== 'corner') return;
    const px = _cornerPx(vals[i]);
    con += `${p}: ${Math.min(px, CORNERS.notch)}px !important;`;
    flat += `${p}: ${Math.min(px, CORNERS.round)}px !important;`;
  });
  return { con, flat };
}

function _cornerWalk(rules, out, wrap) {
  for (const r of rules) {
    if (r.type === 1) {   // style rule
      const c = _cornerRule(r);
      if (!c) continue;
      const one = (look, body) => body && out.push(wrap(`${_cornerSel(r.selectorText, look)} { ${body} }`));
      one('skin-machine', c.con);
      one('tray-flat', c.flat);
      if (r.cssRules && r.cssRules.length) _cornerWalk(r.cssRules, out, wrap);   // nested rules
    } else if (r.cssRules && (r.media || r.conditionText !== undefined)) {
      const head = r.media ? `@media ${r.media.mediaText}` : `@supports ${r.conditionText}`;
      _cornerWalk(r.cssRules, out, t => wrap(`${head} { ${t} }`));
    }
  }
}

function cornersBuild() {
  const out = [];
  const sheets = [...document.styleSheets].filter(s => !(s.ownerNode && s.ownerNode.id === 'corners-style'));
  for (const sh of sheets) {
    let rules; try { rules = sh.cssRules; } catch (e) { continue; }   // a font sheet from another site
    if (rules) _cornerWalk(rules, out, t => t);
  }
  let el = document.getElementById('corners-style');
  if (!el) { el = document.createElement('style'); el.id = 'corners-style'; document.head.appendChild(el); }
  el.textContent = out.join('\n');
  return out.length;
}
// Without corner-shape (Safari, Firefox today) console corners are square, not small and round.
(function () {
  try { if (!CSS.supports('corner-shape', 'notch')) CORNERS.notch = 0; } catch (e) {}
})();

function cornersInit() {
  cornersBuild();
  // Sheets added later (a style a module injects): build again, once, when the count changes.
  new MutationObserver(muts => {
    const added = muts.some(m => [...m.addedNodes].some(n => (n.tagName === 'STYLE' || n.tagName === 'LINK') && n.id !== 'corners-style'));
    if (!added) return;
    clearTimeout(cornersInit._t);
    cornersInit._t = setTimeout(cornersBuild, 300);
  }).observe(document.head, { childList: true });
}
if (document.readyState === 'complete') cornersInit(); else window.addEventListener('load', cornersInit);
