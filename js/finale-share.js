// ══ THE SHARE IMAGE (r680, owner) ═══════════════════════════════════════════
// SHARE on the finale draws the result as a PNG: the headline, how far, the
// numbers, and the build as tiles (every Trick first, then the Knacks, then the
// Sleights as far as one row goes; EXPAND puts every entity on it in as many
// rows as it takes). Drawn by hand on a canvas (no html2canvas here): the amber
// glass, VT323 (the local file), the owner's floppy art (`--fa-<rarity>`,
// js/floppy-art.js) with the pixel icon on its label (the sheet, js/data/icons.js),
// the Knack diamond and the Sleight card drawn as paths. Then the Web Share
// sheet where the browser has one (a phone), or COPY to the clipboard and
// SAVE PNG everywhere. The preview is the image itself.
const FS_W = 1200, FS_H = 675, FS_M = 44;
const FS_AM = '#ffb02e', FS_HI = '#ffd98a', FS_DIM = '#9a6f2a', FS_INK = '#0a0d06';
const FS_RC = { common: '#35d59b', rare: '#16c8d8', epic: '#9a6cff', legendary: '#ff2f8e' };
let _fsImgs = {};
function fsLoad(src) {
  if (!src) return Promise.resolve(null);
  if (_fsImgs[src]) return Promise.resolve(_fsImgs[src]);
  return new Promise(res => { const im = new Image(); im.onload = () => { _fsImgs[src] = im; res(im); }; im.onerror = () => res(null); im.src = src; });
}
function fsFloppyUrl(rar) {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--fa-' + rar).trim();
  const m = v.match(/url\("?([^")]+)"?\)/); return m ? m[1] : '';
}
function fsFont(px, hi) { return `${px}px "VT323 Local", "VT323", monospace`; }
function fsText(x, t, x0, y, px, color, align) { x.font = fsFont(px); x.fillStyle = color; x.textAlign = align || 'left'; x.textBaseline = 'alphabetic'; x.fillText(t, x0, y); }
function fsFit(x, t, px, maxW) { x.font = fsFont(px); while (px > 10 && x.measureText(t).width > maxW) { px -= 1; x.font = fsFont(px); } return px; }
// A pixel icon from the sheet; a light one gets a dark outline (r600's rule).
function fsIcon(x, sheet, glyph, cx, cy, s) {
  const ix = (typeof PX_ICONS !== 'undefined') ? PX_ICONS[glyph] : undefined;
  if (ix == null || !sheet) { fsText(x, glyph || '', cx, cy + s * .36, Math.round(s * .9), '#fff', 'center'); return; }
  const cell = (typeof PX_ICON_SIZE === 'number') ? PX_ICON_SIZE : 32;
  x.imageSmoothingEnabled = false;
  const light = (typeof PX_ICON_LIGHT !== 'undefined') && PX_ICON_LIGHT.includes(ix);
  if (light) { x.save(); x.filter = 'brightness(0)'; const o = Math.max(1, Math.round(s / cell)); [[o, 0], [-o, 0], [0, o], [0, -o]].forEach(([dx, dy]) => x.drawImage(sheet, ix * cell, 0, cell, cell, cx - s / 2 + dx, cy - s / 2 + dy, s, s)); x.restore(); }
  x.drawImage(sheet, ix * cell, 0, cell, cell, cx - s / 2, cy - s / 2, s, s);
  x.imageSmoothingEnabled = true;
}
function fsRound(x, l, t, w, h, r) { x.beginPath(); x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r); x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath(); }
// A Trick: the floppy (art or drawn) with the icon on its label. Box w x w*19/20.
function fsFloppy(x, art, sheet, glyph, rar, l, t, w, fused) {
  const h = w * 19 / 20, rc = fused ? '#e04848' : (FS_RC[rar] || FS_RC.common);
  if (art && fused) {   // a fused Trick is drawn red in the game (r646): the art, tinted
    const k = Math.min(w / art.width, h / art.height), dw = art.width * k, dh = art.height * k;
    x.imageSmoothingEnabled = false; x.drawImage(art, l + (w - dw) / 2, t + (h - dh) / 2, dw, dh);
    x.save(); x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(224,72,72,.55)'; x.fillRect(l, t, w, h); x.restore(); x.imageSmoothingEnabled = true;
    art = null;
  } else if (art) {
    const k = Math.min(w / art.width, h / art.height), dw = art.width * k, dh = art.height * k;
    x.imageSmoothingEnabled = false; x.drawImage(art, l + (w - dw) / 2, t + (h - dh) / 2, dw, dh); x.imageSmoothingEnabled = true;
  } else if (!fused) {
    x.fillStyle = rc; fsRound(x, l, t, w, h, w * .06); x.fill();
    x.fillStyle = '#1a1612'; x.fillRect(l + w * .28, t, w * .44, h * .3);
    x.fillStyle = '#f2eee3'; x.fillRect(l + w * .1, t + h * .44, w * .8, h * .5);
  }
  fsIcon(x, sheet, glyph, l + w / 2, t + h * .67, w * .42);
}
// A Knack: the dark diamond in its rarity, the icon in it.
function fsDiamond(x, sheet, glyph, rar, l, t, w) {
  const rc = FS_RC[rar] || FS_RC.common, cx = l + w / 2, cy = t + w * .475, d = w * .64;
  x.save(); x.translate(cx, cy); x.rotate(Math.PI / 4);
  x.fillStyle = '#17120c'; x.fillRect(-d / 2, -d / 2, d, d);
  x.strokeStyle = rc; x.lineWidth = Math.max(2, w * .035); x.strokeRect(-d / 2, -d / 2, d, d);
  x.globalAlpha = .38; x.fillStyle = rc; x.fillRect(-d / 2, -d / 2, d, d); x.globalAlpha = 1;
  x.restore();
  fsIcon(x, sheet, glyph, cx, cy, d * .6);
}
// A Sleight: the business card in its rarity, the icon centred.
function fsCard(x, sheet, glyph, rar, l, t, w) {
  const rc = FS_RC[rar] || FS_RC.common, h = w * .95, cw = w * .92, ch = h * .66, cl = l + (w - cw) / 2, ct = t + (h - ch) / 2;
  x.fillStyle = '#f2eee3'; fsRound(x, cl, ct, cw, ch, 3); x.fill();
  x.fillStyle = rc; x.fillRect(cl, ct + ch - ch * .18, cw, ch * .18);
  x.strokeStyle = rc; x.lineWidth = 2; fsRound(x, cl, ct, cw, ch, 3); x.stroke();
  fsIcon(x, sheet, glyph, cl + cw / 2, ct + ch * .42, ch * .56);
}
// The image. `all` draws every entity; otherwise one row, Tricks first.
async function finaleShareImage(F, opts) {
  const all = !!(opts && opts.all);
  try { await document.fonts.load(fsFont(40)); } catch (e) {}
  const sheet = (typeof PX_ICON_SHEET === 'string') ? await fsLoad(PX_ICON_SHEET) : null;
  const arts = {};
  for (const r of Object.keys(FS_RC)) arts[r] = (typeof floppyArtOn === 'undefined' || floppyArtOn) ? await fsLoad(fsFloppyUrl(r)) : null;
  const ents = [...F.owned.tricks.map(e => ({ e, type: 'trick' })), ...F.owned.knacks.map(e => ({ e, type: 'knack' })), ...F.owned.sleights.map(e => ({ e, type: 'sleight' }))];
  const innerW = FS_W - FS_M * 2;
  const perRow = 8, T = 110, pitch = innerW / perRow, rowH = T * .95 + 46;
  const shown = all ? ents : ents.slice(0, perRow);
  const rows = Math.max(1, Math.ceil(shown.length / perRow));
  const buildTop = 372;
  const H = Math.max(FS_H, buildTop + 34 + rows * rowH + 56);
  const c = document.createElement('canvas'); c.width = FS_W; c.height = H;
  const x = c.getContext('2d');
  // the glass
  const g = x.createRadialGradient(FS_W / 2, H / 2, 40, FS_W / 2, H / 2, FS_W * .75);
  g.addColorStop(0, '#17240f'); g.addColorStop(1, '#0a0d06'); x.fillStyle = g; x.fillRect(0, 0, FS_W, H);
  x.strokeStyle = 'rgba(76,107,47,.5)'; x.lineWidth = 2; x.strokeRect(5, 5, FS_W - 10, H - 10);
  x.strokeStyle = '#000'; x.lineWidth = 1; x.strokeRect(.5, .5, FS_W - 1, H - 1);
  // the headline
  x.shadowColor = 'rgba(255,176,46,.55)'; x.shadowBlur = 10;
  fsText(x, `> ${F.title}`, FS_M, 96, 64, F.won ? '#94ecb0' : FS_HI);
  x.shadowBlur = 0;
  const sub = [F.mode ? F.mode.toUpperCase() : '', F.far, F.drive ? '' : `${F.rounds} ROUND${F.rounds === 1 ? '' : 'S'}`, finaleClock(F.secs)].filter(Boolean).join('  ·  ');
  fsText(x, sub, FS_M, 136, 28, FS_DIM);
  if (F.records.length) fsText(x, F.records.map(r => '★ ' + r).join('    '), FS_M, 170, 26, '#ffe066');
  // the numbers
  const stats = [
    ['SCORE', F.total.toLocaleString(), ''],
    ['BEST HAND', F.bestHand || '·', F.bestHandScore ? F.bestHandScore.toLocaleString() : ''],
    ['MOST USED', F.mostDef ? F.mostDef.name : '·', F.mostDef ? `${F.mostCount} hand${F.mostCount === 1 ? '' : 's'}` : ''],
    ['HANDS', String(F.hands), `${F.credits} credits`],
  ];
  const bw = (innerW - 3 * 14) / 4, bt = 196, bh = 118;
  stats.forEach(([lab, val, sm], i) => {
    const bl = FS_M + i * (bw + 14);
    x.strokeStyle = FS_DIM; x.lineWidth = 2; x.strokeRect(bl + 1, bt + 1, bw - 2, bh - 2);
    x.fillStyle = '#0e150a'; x.fillRect(bl + 10, bt - 10, x.measureText(lab).width + 20, 20);
    fsText(x, lab, bl + 18, bt + 6, 20, FS_HI);
    const px = fsFit(x, val, 40, bw - 30); fsText(x, val, bl + bw / 2, bt + 66, px, FS_AM, 'center');
    if (sm) fsText(x, sm, bl + bw / 2, bt + 100, 22, FS_DIM, 'center');
  });
  // the build
  fsText(x, `THE BUILD · ${ents.length}${!all && ents.length > shown.length ? `  (${shown.length} shown)` : ''}`, FS_M, buildTop, 24, FS_DIM);
  shown.forEach((it, i) => {
    const r = Math.floor(i / perRow), col = i % perRow;
    const l = FS_M + col * pitch + (pitch - T) / 2, t = buildTop + 22 + r * rowH;
    const glyph = finaleGlyph(it.e, it.type), rar = finaleRarity(it.e, it.type);
    if (it.type === 'trick') fsFloppy(x, arts[rar], sheet, glyph, rar, l, t, T, !!it.e.fused);
    else if (it.type === 'knack') fsDiamond(x, sheet, glyph, rar, l, t, T);
    else fsCard(x, sheet, glyph, rar, l, t, T);
    const name = it.e.name || '';
    const px = fsFit(x, name, 20, pitch - 6);
    fsText(x, name, l + T / 2, t + T * .95 + 26, px, it.e.fused ? '#ff8a8a' : (FS_RC[rar] || FS_AM), 'center');
  });
  if (!ents.length) fsText(x, 'nothing held', FS_M, buildTop + 60, 24, FS_DIM);
  // the foot
  fsText(x, 'OBLIVISCORE', FS_M, H - 22, 24, FS_DIM);
  fsText(x, [F.date, F.seed ? 'seed ' + F.seed : ''].filter(Boolean).join('  ·  '), FS_W - FS_M, H - 22, 22, FS_DIM, 'right');
  // scan lines
  x.fillStyle = 'rgba(0,0,0,.18)'; for (let yy = 0; yy < H; yy += 3) x.fillRect(0, yy, FS_W, 1);
  return c;
}
function fsBlob(c) { return new Promise(res => c.toBlob(res, 'image/png')); }
function fsFileName(F) { return `obliviscore-${(F.mode || 'run').toLowerCase().replace(/\s+/g, '-')}-${F.won ? 'win' : 'run'}-${Date.now().toString(36)}.png`; }
// The SHARE sub-view: the image, and SHARE / COPY / SAVE PNG / EXPAND.
async function finaleShareView(F) {
  let all = !!(F._shareAll);
  const render = async () => {
    const c = await finaleShareImage(F, { all });
    const ctl = _fnCtl; if (!ctl) return;
    const im = ctl.body.querySelector('#fn-share-img'); if (im) { im.src = c.toDataURL('image/png'); im._canvas = c; }
    const ex = ctl.keys.querySelector('#fn-expand'); if (ex) ex.textContent = all ? 'FEWER' : 'EXPAND';
    const note = ctl.body.querySelector('#fn-share-note'); if (note) note.textContent = all ? 'Every Trick, Knack and Sleight.' : 'Your Tricks first, then as many Knacks and Sleights as fit. EXPAND shows them all.';
  };
  const blobOf = async () => { const im = _fnCtl && _fnCtl.body.querySelector('#fn-share-img'); return im && im._canvas ? fsBlob(im._canvas) : null; };
  const say = (t) => { const n = _fnCtl && _fnCtl.body.querySelector('#fn-share-note'); if (n) n.textContent = t; };
  const canShare = !!(navigator.canShare && navigator.share);
  const keys = [];
  if (canShare) keys.push({ label: 'SHARE', primary: true, fn: async () => { try { const b = await blobOf(); if (!b) return; const f = new File([b], fsFileName(F), { type: 'image/png' }); if (navigator.canShare({ files: [f] })) await navigator.share({ files: [f], title: `${F.title} · ${F.mode}` }); else say('Sharing a file is not supported here. COPY or SAVE PNG.'); } catch (e) { if (!/abort/i.test(String(e))) say('Share did not go through. COPY or SAVE PNG.'); } } });
  keys.push({ label: 'COPY', primary: !canShare, fn: async () => { try { const b = await blobOf(); if (!b) return; await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]); say('Copied. Paste it anywhere that takes an image.'); } catch (e) { say('Copy is not supported here. SAVE PNG instead.'); } } });
  keys.push({ label: 'SAVE PNG', fn: async () => { const b = await blobOf(); if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = fsFileName(F); document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); say('Saved to your downloads.'); } });
  keys.push({ label: all ? 'FEWER' : 'EXPAND', id: 'fn-expand', fn: async () => { all = !all; F._shareAll = all; await render(); } });
  finaleSubView(`<div class="fn-share"><img id="fn-share-img" alt="the run"><div class="bs-sub" id="fn-share-note">drawing...</div></div>`, keys);
  await render();
}
