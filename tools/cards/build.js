#!/usr/bin/env node
// Cuts Jfred's Pixel Cards (CC0, https://jfredd.itch.io/pixel-cards) into the
// pieces the card face draws: the top-left INDEX (rank over suit, drawn again
// rotated bottom-right) and the centre ART, so a card keeps crisp pixels at any
// cell shape instead of being stretched with the cell.
//
//   node tools/cards/build.js --src /path/to/unzipped/cards
//
// Writes assets/cards/jfred/faces.png (one sheet: art cells in the top row,
// index cells in a row beneath), js/data/card-faces.js (CARD_FACES: '♥K' ->
// {a:[x,y,w,h], ax, ay, i:[x,y,w,h], ix, iy}, the joker as 'joker' with art only) and
// assets/cards/jfred/CREDITS.md.
const fs = require('fs');
const path = require('path');
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const SRC = arg('--src');
const OUT_SHEET = arg('--sheet', 'assets/cards/jfred/faces.png');
const OUT_JS = arg('--js', 'js/data/card-faces.js');
const OUT_CREDITS = arg('--credits', 'assets/cards/jfred/CREDITS.md');
if (!SRC) { console.error('need --src <dir holding hearts/ spades/ ... joker.png>'); process.exit(1); }

const SUITS = { hearts: '♥', diamonds: '♦', spades: '♠', clubs: '♣' };
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const cards = [];
for (const [dir, sym] of Object.entries(SUITS)) for (const r of RANKS) cards.push({ key: sym + r, file: path.join(SRC, dir, r + '.png') });
cards.push({ key: 'joker', file: path.join(SRC, 'joker.png'), joker: true });
for (const c of cards) if (!fs.existsSync(c.file)) { console.error('missing ' + c.file); process.exit(1); }

(async () => {
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const srcs = cards.map(c => 'data:image/png;base64,' + fs.readFileSync(c.file).toString('base64'));
  const out = await page.evaluate(async ({ srcs, jokers }) => {
    const W = 50, H = 75;
    const imgs = [];
    for (const s of srcs) { const im = new Image(); await new Promise((res, rej) => { im.onload = res; im.onerror = rej; im.src = s; }); imgs.push(im); }
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    // Ink is anything that is not the cream stock, the grey outline or clear.
    const isInk = (d, i) => d[i + 3] > 127
      && !(Math.abs(d[i] - 255) <= 20 && Math.abs(d[i + 1] - 249) <= 20 && Math.abs(d[i + 2] - 239) <= 24)
      && !(Math.abs(d[i] - 209) < 12 && Math.abs(d[i + 1] - 203) < 10 && Math.abs(d[i + 2] - 193) < 10);
    const bbox = (d, x0, y0, x1, y1) => {
      let a = W, b = H, c = -1, e = -1;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (isInk(d, (y * W + x) * 4)) { if (x < a) a = x; if (x > c) c = x; if (y < b) b = y; if (y > e) e = y; }
      return c < 0 ? null : [a, b, c - a + 1, e - b + 1];
    };
    const parts = imgs.map((im, n) => {
      ctx.clearRect(0, 0, W, H); ctx.drawImage(im, 0, 0);
      const d = ctx.getImageData(0, 0, W, H).data;
      // Border ring and corners are never ink.
      const art = jokers[n] ? bbox(d, 2, 2, 47, 72) : bbox(d, 10, 2, 39, 72);
      const idx = jokers[n] ? null : bbox(d, 2, 2, 9, 18);
      return { art, idx };
    });
    // Sheet: art cells left to right (row 0, height = tallest art), index cells beneath.
    const artH = Math.max(...parts.map(p => p.art[3]));
    const idxH = Math.max(...parts.filter(p => p.idx).map(p => p.idx[3]));
    const artW = parts.reduce((s, p) => s + p.art[2], 0);
    const idxW = parts.reduce((s, p) => s + (p.idx ? p.idx[2] : 0), 0);
    const sheet = document.createElement('canvas'); sheet.width = Math.max(artW, idxW); sheet.height = artH + idxH;
    const sc = sheet.getContext('2d');
    // Only ink is copied: the stock behind it is the game's own card.
    const copyInk = (im, box, dx, dy) => {
      ctx.clearRect(0, 0, W, H); ctx.drawImage(im, 0, 0);
      const src = ctx.getImageData(box[0], box[1], box[2], box[3]);
      const d = src.data; const full = ctx.getImageData(0, 0, W, H).data;
      for (let y = 0; y < box[3]; y++) for (let x = 0; x < box[2]; x++) {
        const i = ((box[1] + y) * W + (box[0] + x)) * 4;
        if (!isInk(full, i)) { const j = (y * box[2] + x) * 4; d[j + 3] = 0; }
      }
      sc.putImageData(src, dx, dy);
    };
    const map = []; let ax = 0, ix = 0;
    parts.forEach((p, n) => {
      const m = { a: [ax, 0, p.art[2], p.art[3]], ax: p.art[0], ay: p.art[1] };
      copyInk(imgs[n], p.art, ax, 0); ax += p.art[2];
      if (p.idx) { m.i = [ix, artH, p.idx[2], p.idx[3]]; m.ix = p.idx[0]; m.iy = p.idx[1]; copyInk(imgs[n], p.idx, ix, artH); ix += p.idx[2]; }
      map.push(m);
    });
    return { png: sheet.toDataURL('image/png'), map, w: sheet.width, h: sheet.height, artH, idxH };
  }, { srcs, jokers: cards.map(c => !!c.joker) });
  await browser.close();

  const buf = Buffer.from(out.png.split(',')[1], 'base64');
  fs.mkdirSync(path.dirname(OUT_SHEET), { recursive: true });
  fs.writeFileSync(OUT_SHEET, buf);
  const hash = require('crypto').createHash('sha1').update(buf).digest('hex').slice(0, 8);
  const rows = cards.map((c, n) => `  ${JSON.stringify(c.key)}: ${JSON.stringify(out.map[n])},`).join('\n');
  fs.writeFileSync(OUT_JS,
`// GENERATED by tools/cards/build.js from Jfred's Pixel Cards (CC0). Do not edit; rerun the tool.
// Source cards are 50 x 75; every box is in those pixels. a = centre art [x, y, w, h] on the sheet,
// (ax, ay) is where the art sits on the card; i = corner index on the sheet, drawn at (ix, iy) of the
// card and again rotated bottom-right.
const CARD_FACE_SHEET = '${OUT_SHEET}?v=${hash}';
const CARD_FACE_SRC_W = 50, CARD_FACE_SRC_H = 75;
const CARD_FACE_SHEET_W = ${out.w}, CARD_FACE_SHEET_H = ${out.h};
const CARD_FACES = {
${rows}
};
`);
  fs.writeFileSync(OUT_CREDITS, `# Card face credits

The playing card faces (\`faces.png\`) are cut from **Pixel Cards** by Jfred,
https://jfredd.itch.io/pixel-cards, released under CC0 (public domain dedication):
the corner index and the centre art of each of the 52 cards, and the Joker, which
the game uses for its wild card. \`tools/cards/build.js\` makes the sheet.
`);
  console.log(`wrote ${OUT_SHEET} (${out.w}x${out.h}, ${buf.length} bytes, v=${hash}), ${OUT_JS}, ${OUT_CREDITS}`);
})().catch(e => { console.error(e); process.exit(1); });
