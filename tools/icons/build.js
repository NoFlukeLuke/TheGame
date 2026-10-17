#!/usr/bin/env node
// Pixelates game-icons.net SVGs into one sprite sheet.
//
//   node tools/icons/build.js --src /path/to/game-icons-checkout [--size 16] [--dump]
//
// Reads tools/icons/manifest.js (glyph -> icon, colour), renders each SVG with
// the preinstalled Chromium (Playwright), reduces it to a SIZE x SIZE grid of
// ink/no-ink cells, shades the ink in three tones of the row's colour (lit on
// top, shadow underneath), and writes:
//   assets/icons/entities.png   the sheet, SIZE px tall, one cell per icon
//   js/data/icons.js            PX_ICONS: glyph -> cell index, plus the sheet url
//   assets/icons/CREDITS.md     every icon with its author (CC BY 3.0)
// --dump prints each icon as text so a change can be judged without a browser.
// --style multi colours by depth (outline, body, a second hue in the core); --size 32 gives it room.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const SRC = arg('--src');
const SIZE = +arg('--size', 16);
const MARGIN = +arg('--margin', 1);
const THRESH = +arg('--thresh', 0.42);
const DUMP = args.includes('--dump');
const OUT_SHEET = arg('--sheet', 'assets/icons/entities.png');
const OUT_JS = arg('--js', 'js/data/icons.js');
const OUT_CREDITS = arg('--credits', 'assets/icons/CREDITS.md');
const OUT_CONTACT = arg('--contact', '');   // optional big preview png
const STYLE = arg('--style', 'tone');        // tone: three tones; multi: banded by depth with a second hue
if (!SRC) { console.error('need --src <game-icons checkout>'); process.exit(1); }

const { PALETTE, ICONS } = require('./manifest.js');

// Every svg in the checkout, by author/name and by bare name.
const all = execSync('git ls-tree -r --name-only HEAD', { cwd: SRC, encoding: 'utf8' })
  .split('\n').filter(p => p.endsWith('.svg'));
const byFull = new Map(), byName = new Map();
for (const p of all) {
  const full = p.replace(/\.svg$/, '');
  byFull.set(full, p);
  const name = full.split('/').pop();
  if (!byName.has(name)) byName.set(name, p);
}
const missing = [];
const rows = ICONS.map(row => {
  const p = row.icon.includes('/') ? byFull.get(row.icon) : byName.get(row.icon);
  if (!p) { missing.push(row.icon); return null; }
  if (!PALETTE[row.color]) { missing.push(row.icon + ' (colour ' + row.color + ')'); return null; }
  return { ...row, file: p, author: p.split('/')[0] };
}).filter(Boolean);
if (missing.length) { console.error('not found:\n  ' + missing.join('\n  ')); process.exit(1); }

// The checkout may be blobless; pull the files we need in one go.
const need = rows.map(r => r.file).filter(f => !fs.existsSync(path.join(SRC, f)));
if (need.length) execSync('git checkout HEAD -- ' + need.map(f => `"${f}"`).join(' '), { cwd: SRC, stdio: 'inherit' });

function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > .5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hslToHex(h, s, l) {
  const f = n => { const k = (n + h / 30) % 12, a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return '#' + [f(0), f(8), f(4)].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
}
// Three tones from one colour: lit (top edges), base, shadow (bottom edges).
function tones(hex) {
  const [h, s, l] = hexToHsl(hex);
  return {
    hi: hslToHex(h, Math.max(0, s - .1), Math.min(1, l + .2)),
    base: hex,
    lo: hslToHex(h, Math.min(1, s + .1), Math.max(0, l - .24)),
  };
}

(async () => {
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const svgs = rows.map(r => fs.readFileSync(path.join(SRC, r.file), 'utf8'));

  // One trip into the page: rasterise every icon to an ink grid.
  const grids = await page.evaluate(async ({ svgs, cuts, size, margin, thresh }) => {
    const SS = 8;                               // supersample per cell
    const inner = size - margin * 2;
    const big = document.createElement('canvas'); big.width = big.height = 512;
    const bctx = big.getContext('2d', { willReadFrequently: true });
    const small = document.createElement('canvas'); small.width = small.height = inner * SS;
    const sctx = small.getContext('2d', { willReadFrequently: true });
    const out = [];
    for (let [si, svg0] of svgs.entries()) {
      let svg = svg0; const cutFlag = cuts[si];
      // game-icons ship a black square under white ink; drop the square.
      svg = svg.replace(/<path d="M0 0h512v512H0z"[^>]*\/>/, '');
      const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
      bctx.clearRect(0, 0, 512, 512); bctx.drawImage(img, 0, 0, 512, 512);
      let d = bctx.getImageData(0, 0, 512, 512).data;
      // Normalise to white ink on clear. With `cut`, the icon is instead what
      // is CUT OUT of the ink: flood the clear pixels reachable from the edge,
      // and what stays clear inside is the picture.
      {
        const ink = new Uint8Array(512 * 512); let inkN = 0;
        // Ink is the WHITE paint: a badge icon draws its picture in black on
        // top of a white disc, and the black part is not the icon.
        for (let i = 0; i < 512 * 512; i++) if (d[i * 4 + 3] > 127 && d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2] > 384) { ink[i] = 1; inkN++; }
        const seen = new Uint8Array(512 * 512); const q = [];
        for (let i = 0; i < 512; i++) q.push(i, 511 * 512 + i, i * 512, i * 512 + 511);
        while (q.length) { const i = q.pop(); if (seen[i] || ink[i]) continue; seen[i] = 1;
          const x = i % 512, y = (i / 512) | 0;
          if (x > 0) q.push(i - 1); if (x < 511) q.push(i + 1); if (y > 0) q.push(i - 512); if (y < 511) q.push(i + 512); }
        let holeN = 0; for (let i = 0; i < 512 * 512; i++) if (!ink[i] && !seen[i]) holeN++;
        const cut = !!cutFlag;
        {
          const img2 = bctx.createImageData(512, 512);
          if (cut) for (let i = 0; i < 512 * 512; i++) if (!ink[i] && !seen[i]) { img2.data[i * 4] = img2.data[i * 4 + 1] = img2.data[i * 4 + 2] = 255; img2.data[i * 4 + 3] = 255; }
          if (!cut) for (let i = 0; i < 512 * 512; i++) if (ink[i]) { img2.data[i * 4] = img2.data[i * 4 + 1] = img2.data[i * 4 + 2] = 255; img2.data[i * 4 + 3] = 255; } else img2.data[i * 4 + 3] = 0;
          bctx.clearRect(0, 0, 512, 512); bctx.putImageData(img2, 0, 0);
          d = img2.data;
        }
      }
      let x0 = 512, y0 = 512, x1 = -1, y1 = -1;
      for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
        if (d[(y * 512 + x) * 4 + 3] > 127) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
      const grid = Array.from({ length: size }, () => new Array(size).fill(0));
      if (x1 >= 0) {
        // Fit the ink's box into the inner square, centred, aspect kept.
        const bw = x1 - x0 + 1, bh = y1 - y0 + 1, k = Math.max(bw, bh);
        const sx = Math.max(0, x0 - (k - bw) / 2), sy = Math.max(0, y0 - (k - bh) / 2);
        sctx.clearRect(0, 0, small.width, small.height);
        sctx.imageSmoothingEnabled = true; sctx.imageSmoothingQuality = 'high';
        sctx.drawImage(big, sx, sy, k, k, 0, 0, small.width, small.height);
        const s = sctx.getImageData(0, 0, small.width, small.height).data;
        for (let cy = 0; cy < inner; cy++) for (let cx = 0; cx < inner; cx++) {
          let sum = 0;
          for (let yy = 0; yy < SS; yy++) for (let xx = 0; xx < SS; xx++)
            sum += s[((cy * SS + yy) * small.width + (cx * SS + xx)) * 4 + 3];
          grid[cy + margin][cx + margin] = (sum / (SS * SS * 255)) >= thresh ? 1 : 0;
        }
      }
      URL.revokeObjectURL(url);
      out.push(grid);
    }
    return out;
  }, { svgs, cuts: rows.map(r => r.cut == null ? null : !!r.cut), size: SIZE, margin: MARGIN, thresh: THRESH });

  // Multi: colour by DEPTH into the ink. The rim is the dark outline, the next
  // ring the base, and the core a second hue, so a big icon reads as drawn in
  // several colours. Lit top edges still take the highlight.
  function multiTones(hex) {
    const [h, s, l] = hexToHsl(hex);
    return {
      edge: hslToHex(h, Math.min(1, s + .1), Math.max(0, l - .34)),
      lo: hslToHex(h, Math.min(1, s + .1), Math.max(0, l - .18)),
      base: hex,
      hi: hslToHex(h, Math.max(0, s - .1), Math.min(1, l + .2)),
      core: hslToHex((h + 42) % 360, Math.min(1, s + .05), Math.min(1, l + .06)),
      core2: hslToHex((h + 42) % 360, Math.max(0, s - .05), Math.min(1, l + .22)),
    };
  }
  function depthMap(g) {
    const d = g.map(r => r.map(v => v ? Infinity : 0));
    const q = [];
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (!g[y][x]) q.push([y, x]);
    // Cells on the sheet edge count as bordering sky.
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (g[y][x] && (y === 0 || x === 0 || y === SIZE - 1 || x === SIZE - 1)) { d[y][x] = 1; q.push([y, x]); }
    while (q.length) { const [y, x] = q.shift();
      for (const [dy, dx] of [[1,0],[-1,0],[0,1],[0,-1]]) { const ny = y + dy, nx = x + dx;
        if (ny < 0 || nx < 0 || ny >= SIZE || nx >= SIZE || !g[ny][nx]) continue;
        if (d[ny][nx] > d[y][x] + 1) { d[ny][nx] = d[y][x] + 1; q.push([ny, nx]); } } }
    return d;
  }
  const shaded = STYLE === 'multi' ? grids.map((g, i) => {
    const t = multiTones(PALETTE[rows[i].color]);
    const d = depthMap(g);
    const coreAt = Math.max(3, Math.round(SIZE / 10));
    return g.map((row, y) => row.map((v, x) => {
      if (!v) return null;
      const up = y > 0 && g[y - 1][x];
      if (d[y][x] === 1) return (!up && y > 0) ? t.hi : t.edge;
      if (d[y][x] === 2) return (!up || (y > 1 && !g[y - 2][x])) ? t.base : t.lo;
      if (d[y][x] < coreAt) return t.base;
      return (y > 0 && d[y - 1][x] < coreAt) ? t.core2 : t.core;
    }));
  }) :
  // Shade: an ink cell with sky above is lit, one with nothing below is in shadow.
  grids.map((g, i) => {
    const t = tones(PALETTE[rows[i].color]);
    return g.map((row, y) => row.map((v, x) => {
      if (!v) return null;
      const up = y > 0 && g[y - 1][x], down = y < SIZE - 1 && g[y + 1][x];
      const left = x > 0 && g[y][x - 1], right = x < SIZE - 1 && g[y][x + 1];
      if (!down && up) return t.lo;
      if (!up && down) return t.hi;
      if (!right && left) return t.lo;
      if (!left && right) return t.hi;
      return t.base;
    }));
  });

  if (DUMP) shaded.forEach((g, i) => {
    console.log(rows[i].glyph, rows[i].icon, rows[i].color);
    console.log(g.map(r => r.map(c => c == null ? '·' : '█').join('')).join('\n'));
  });

  // Compose the sheet (and the contact sheet) in the page and take PNGs back.
  const pngs = await page.evaluate(({ shaded, size, scale }) => {
    const n = shaded.length;
    const sheet = document.createElement('canvas'); sheet.width = size * n; sheet.height = size;
    const ctx = sheet.getContext('2d');
    shaded.forEach((g, i) => g.forEach((row, y) => row.forEach((c, x) => { if (c) { ctx.fillStyle = c; ctx.fillRect(i * size + x, y, 1, 1); } })));
    const cols = 16, rowsN = Math.ceil(n / cols), cell = size * scale + 8;
    const big = document.createElement('canvas'); big.width = cols * cell; big.height = rowsN * cell;
    const b = big.getContext('2d'); b.fillStyle = '#1a1510'; b.fillRect(0, 0, big.width, big.height);
    b.imageSmoothingEnabled = false;
    shaded.forEach((g, i) => b.drawImage(sheet, i * size, 0, size, size, (i % cols) * cell + 4, Math.floor(i / cols) * cell + 4, size * scale, size * scale));
    return { sheet: sheet.toDataURL('image/png'), contact: big.toDataURL('image/png') };
  }, { shaded, size: SIZE, scale: 4 });
  await browser.close();

  const sheetBuf = Buffer.from(pngs.sheet.split(',')[1], 'base64');
  fs.mkdirSync(path.dirname(OUT_SHEET), { recursive: true });
  fs.writeFileSync(OUT_SHEET, sheetBuf);
  if (OUT_CONTACT) fs.writeFileSync(OUT_CONTACT, Buffer.from(pngs.contact.split(',')[1], 'base64'));

  const hash = require('crypto').createHash('sha1').update(sheetBuf).digest('hex').slice(0, 8);
  const map = rows.map((r, i) => `  ${JSON.stringify(r.glyph)}: ${i},`).join('\n');
  fs.writeFileSync(OUT_JS,
`// GENERATED by tools/icons/build.js from tools/icons/manifest.js. Do not edit; rerun the tool.
// ${rows.length} icons from game-icons.net (CC BY 3.0), ${SIZE}px, three tones each.
const PX_ICON_SIZE = ${SIZE};
const PX_ICON_SHEET = '${OUT_SHEET}?v=${hash}';
const PX_ICON_AUTHORS = ${JSON.stringify([...new Set(rows.map(r => r.author))].sort())};
const PX_ICONS = {
${map}
};
`);
  const authors = {};
  rows.forEach(r => { (authors[r.author] = authors[r.author] || []).push(`${r.glyph} ${r.file.replace(/\.svg$/, '').split('/').pop()}`); });
  fs.writeFileSync(OUT_CREDITS,
`# Icon credits

The pixel icons in \`entities.png\` are made from icons on https://game-icons.net,
licensed CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/). Each was reduced
to a ${SIZE}px grid and recoloured by \`tools/icons/build.js\`.

${Object.keys(authors).sort().map(a => `## ${a}\n\n${authors[a].map(s => '- ' + s).join('\n')}`).join('\n\n')}
`);
  console.log(`wrote ${OUT_SHEET} (${rows.length} icons, ${sheetBuf.length} bytes, v=${hash}), ${OUT_JS}, ${OUT_CREDITS}`);
})().catch(e => { console.error(e); process.exit(1); });
