// ══════════════════════════════════════════════════════════════════════════
// BUILDS (r634) - every Trick, Sleight and Knack in the game on one screen,
// narrowed by what it does, grouped how you like, and a draft build you can
// save, track in a run, share or test-drive.
//
// NOT to be confused with RECORDS' "Owned" tab (js/records.js), which lists
// what you hold in the CURRENT run. This is the whole catalogue, gated by what
// you have found (js/discovery.js), and it lives on the main menu.
//
// THE AXIS IS THE TAG TABLE (js/data/tags.js), never the text: each entity's
// `tags` say what it pays, per card or per hand, what has to be true, and how
// it behaves. The filter bar is one dropdown per tag group plus type, rarity,
// file state and Sleight activation; every dropdown is multi-select; a record
// is shown only if it passes every dropdown that has something ticked, and
// what is hidden leaves no gap. The search box is secondary: approximate text
// matching over the name and the description, for finding one thing by name.
//
// GROUP BY picks the one separation drawn on the canvas: rarity, type, A-Z, or
// a tag group (a record then sits under every tag of that group it carries).
//
// LEFT COLUMN: the draft build (tiles, warnings, save / track / test drive /
// share) and the view toggles - potential synergies, offer odds, run stats.
//
// FILE STATE (js/discovery.js): open / FILE MISSING (never acquired) /
// LOCKED (behind a task). The owner will build the unlock tasks.
// ══════════════════════════════════════════════════════════════════════════

const BV_KEY = 'lethe.builds.v2';
const BV_GROUPS = ['rarity', 'type', 'alpha', 'pays', 'scope', 'when', 'how', 'act'];
const BV_RARITIES = ['common', 'rare', 'epic', 'legendary'];
const BV_FILE = [['open', 'Found'], ['missing', 'Not found yet'], ['classified', 'Locked']];
const BV_ACTS = [['double_tap', 'Double-tap'], ['on_play', 'On play'], ['on_discard', 'On discard'], ['on_swap', 'On swap'],
  ['passive', 'Passive'], ['adjacent', 'Adjacent'], ['wildcard', 'Wild'], ['aim', 'Aim'], ['on_draw', 'On draw'], ['round_end', 'Round end']];
const BV_ACT_LABEL = Object.fromEntries(BV_ACTS);

// View state. Stored overrides-only.
const BV_DEFAULT = { group: 'rarity', q: '', zoom: 1, syn: false, odds: false, stats: false, hidden: true,
  f: { type: [], rar: [], file: [], pays: [], scope: [], when: [], how: [], act: [] } };
let bv = bvLoad();
function bvLoad() {
  const d = JSON.parse(JSON.stringify(BV_DEFAULT));
  try { const s = JSON.parse(localStorage.getItem(BV_KEY) || '{}'); Object.assign(d, s); d.f = { ...BV_DEFAULT.f, ...(s.f || {}) }; } catch (e) {}
  return d;
}
function bvSave() {
  const o = {};
  for (const k in bv) { if (k === 'f' || k === 'q') continue; if (bv[k] !== BV_DEFAULT[k]) o[k] = bv[k]; }
  const f = {}; for (const k in bv.f) if (bv.f[k].length) f[k] = bv.f[k];
  if (Object.keys(f).length) o.f = f;
  try { if (Object.keys(o).length) localStorage.setItem(BV_KEY, JSON.stringify(o)); else localStorage.removeItem(BV_KEY); } catch (e) {}
}

let buildsOpen = false;
let draftBuild = { name: '', tricks: [], sleights: [], knacks: [] };
let bvPinned = null;         // the record whose synergies are lit (id)
let bvLadders = new Set();   // records with their improvement rows open

// ── the catalogue ───────────────────────────────────────────────────────────
// One wrapper per entity, built once per open: everything the filters and the
// records read, so nothing below has to know which pool a thing came from.
let bvAll = [];
function bvBuildCatalogue() {
  // r651: a rare / epic / fused Trick not yet taken prints no name (js/discovery.js); fused
  // Tricks are the INSEPARABLE type and are listed only once one pair has been made.
  const wrap = (e, type) => ({
    e, type, id: e.id, name: (type === 'trick' && typeof shownEntityName === 'function') ? shownEntityName(e, 'trick') : (e.name || e.id), desc: e.desc || '',
    fused: !!e.fused,
    rar: tierId(type === 'trick' ? e.tier : e.rarity),
    tags: Array.isArray(e.tags) ? e.tags : [],
    act: type === 'sleight' ? (e.activation || '') : '',
    state: fileState(e.id),
    lc: ((e.name || '') + ' ' + (e.desc || '')).toLowerCase(),
  });
  bvAll = [
    ...TRICK_POOL_ALL.filter(t => !t.retired && (!t.fused || (typeof anyPairDiscovered === 'function' && anyPairDiscovered()))).map(t => wrap(t, 'trick')),
    ...SLEIGHT_POOL.map(s => wrap(s, 'sleight')),
    ...KNACK_POOL.map(k => wrap(k, 'knack')),
  ];
}
function bvFind(type, id) { return bvAll.find(x => x.type === type && x.id === id) || null; }

// ── filters ─────────────────────────────────────────────────────────────────
// Each dropdown is a group; `bvPassGroup(x, g)` is one group's test so the
// counts in a dropdown can be taken over the set every OTHER group lets through.
function bvGroupValues(x, g) {
  switch (g) {
    case 'type': return [x.fused ? 'inseparable' : x.type];
    case 'rar':  return [x.rar];
    case 'file': return [x.state];
    case 'act':  return x.act ? [x.act] : [];
    default:     return x.tags.filter(t => tagDef(t) && tagDef(t).group === g);
  }
}
function bvPassGroup(x, g) {
  const want = bv.f[g]; if (!want || !want.length) return true;
  const vals = bvGroupValues(x, g);
  return vals.some(v => want.includes(v));
}
function bvPassAll(x, except) {
  for (const g in bv.f) if (g !== except && !bvPassGroup(x, g)) return false;
  if (!bv.hidden && x.state !== 'open') return false;
  return bvSearchHit(x);
}
function bvShown() { return bvAll.filter(x => bvPassAll(x)); }

// ── approximate search ──────────────────────────────────────────────────────
// Every typed word must land somewhere in the name or the description: as a
// substring, as a word within one edit (two for long words), or as a prefix
// of a word. Names win over descriptions only in the ordering, not the test.
function bvEdit(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = new Array(b.length + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let left = i, best = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, left + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev[j - 1] = left; left = v; if (v < best) best = v;
    }
    prev[b.length] = left;
    if (best > max) return max + 1;
  }
  return prev[b.length];
}
function bvWordHit(tok, words) {
  const max = tok.length >= 7 ? 2 : tok.length >= 4 ? 1 : 0;
  return words.some(w => w.startsWith(tok) || (max && bvEdit(tok, w, max) <= max));
}
function bvSearchHit(x) {
  const q = (bv.q || '').trim().toLowerCase();
  if (!q) return true;
  const toks = q.split(/\s+/).filter(Boolean);
  if (!x._words) x._words = x.lc.replace(/[^a-z0-9+×x ]+/g, ' ').split(/\s+/).filter(Boolean);
  return toks.every(t => x.lc.includes(t) || bvWordHit(t, x._words));
}

// ── grouping ────────────────────────────────────────────────────────────────
function bvGroupsOf(list) {
  const g = bv.group;
  const by = new Map();
  const put = (key, label, cls, x) => {
    if (!by.has(key)) by.set(key, { key, label, cls, items: [] });
    by.get(key).items.push(x);
  };
  list.forEach(x => {
    if (g === 'rarity') put(x.rar, tierLabel(x.type, x.rar).toUpperCase(), 'r-' + x.rar, x);
    else if (g === 'type') { const ty = x.fused ? 'inseparable' : x.type; put(ty, entityLabel(ty, true).toUpperCase(), 't-' + ty, x); }
    else if (g === 'alpha') { const L = (x.name[0] || '#').toUpperCase(); put(/[A-Z]/.test(L) ? L : '#', L, '', x); }
    else if (g === 'act') put(x.act || '·', x.act ? BV_ACT_LABEL[x.act].toUpperCase() : 'NOT A SLEIGHT', '', x);
    else {
      const vals = bvGroupValues(x, g);
      if (!vals.length) put('·', 'NONE', '', x);
      vals.forEach(v => { const d = tagDef(v); put(v, d.label.toUpperCase(), d.cls, x); });
    }
  });
  let out = [...by.values()];
  if (g === 'rarity') out.sort((a, b) => BV_RARITIES.indexOf(a.key) - BV_RARITIES.indexOf(b.key));
  else if (g === 'type') out.sort((a, b) => ['trick', 'inseparable', 'sleight', 'knack'].indexOf(a.key) - ['trick', 'inseparable', 'sleight', 'knack'].indexOf(b.key));
  else if (g === 'alpha') out.sort((a, b) => a.key.localeCompare(b.key));
  else if (g === 'act') out.sort((a, b) => (a.key === '·') - (b.key === '·') || b.items.length - a.items.length);
  else { const order = tagsInGroup(g).map(d => d.id); out.sort((a, b) => (a.key === '·') - (b.key === '·') || order.indexOf(a.key) - order.indexOf(b.key)); }
  out.forEach(gr => gr.items.sort((a, b) => a.name.localeCompare(b.name)));
  return out;
}

// ── synergies ───────────────────────────────────────────────────────────────
// Two records are a potential synergy when they care about the same thing
// (a shared WHEN tag), or one makes cards score again and the other pays per
// card, or one retriggers Tricks and the other is a scoring Trick. Shown as a lit ring
// on the matches and a dim on the rest while one record is pinned.
function bvSynergy(a, b) {
  if (a === b) return 0;
  const A = new Set(a.tags), B = new Set(b.tags);
  let n = 0;
  tagsInGroup('when').forEach(d => { if (A.has(d.id) && B.has(d.id)) n += 2; });
  if ((A.has('replay') && B.has('card')) || (B.has('replay') && A.has('card'))) n += 2;
  if ((A.has('retrigger') && b.type === 'trick' && B.has('scores')) || (B.has('retrigger') && a.type === 'trick' && A.has('scores'))) n += 2;
  if ((A.has('focus') && B.has('focus'))) n += 1;
  if ((A.has('scaling') && B.has('scaling'))) n += 1;
  if (a.act && a.act === b.act) n += 1;
  return n;
}

// ── odds ────────────────────────────────────────────────────────────────────
// How often one offer of this type is THIS entity, with no Luck: the tier's
// share of the table (js/data/balance.js ENTITY_TIER_W) split evenly over the
// tier's members in this type's pool. Honest about what it is: every offer
// path rolls the same table, but mode bans and the run's own pool filters
// move it a little.
function bvOdds(x) {
  const w = (typeof luckTierWeights === 'function') ? luckTierWeights(ENTITY_TIER_W) : ENTITY_TIER_W;
  const sum = w.reduce((a, b) => a + b, 0) || 1;
  const ti = ENTITY_TIERS.indexOf(x.rar);
  const peers = bvAll.filter(y => y.type === x.type && y.rar === x.rar).length || 1;
  const p = (w[ti] / sum) / peers;
  return { p, oneIn: Math.round(1 / p), tierPct: Math.round(w[ti] / sum * 1000) / 10, peers };
}

// ── run stats ───────────────────────────────────────────────────────────────
// From the run history (js/history.js), which stores Trick and Knack NAMES.
let _bvStats = null;
function bvStatsFor(x) {
  if (!_bvStats) {
    _bvStats = {};
    const hist = (typeof readRunHistory === 'function') ? readRunHistory() : [];
    hist.forEach(r => [...(r.tricks || []), ...(r.knacks || [])].forEach(n => {
      const s = _bvStats[n] = _bvStats[n] || { runs: 0, wins: 0, best: 0 };
      s.runs++; if (r.outcome === 'win') s.wins++; if (r.score > s.best) s.best = r.score;
    }));
  }
  return _bvStats[x.name] || null;
}

// ── open / close ────────────────────────────────────────────────────────────
function openBuilds() {
  buildsOpen = true;
  syncDiscoveredFromOwned();
  _bvStats = null;
  bvBuildCatalogue();
  ensureBuildsOverlay();
  document.getElementById('main-menu-overlay')?.classList.remove('show');
  document.getElementById('builds-overlay').classList.add('show');
  renderBuilds();
}
function closeBuilds() {
  buildsOpen = false;
  bvSave();
  document.getElementById('builds-overlay')?.classList.remove('show');
  document.getElementById('main-menu-overlay')?.classList.add('show');
}

function ensureBuildsOverlay() {
  let el = document.getElementById('builds-overlay');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'builds-overlay';
  el.innerHTML = `
    <div class="bv-bar">
      <button class="bv-key bv-back" onclick="closeBuilds()">&#9664; MENU</button>
      <span class="bv-title">BUILDS</span>
      <span class="bv-sub" id="bv-count"></span>
      <label class="bv-search"><span>&#9906;</span><input id="bv-q" type="search" placeholder="search by name or words" autocomplete="off" spellcheck="false"></label>
      <button class="bv-key bv-rail-btn" id="bv-rail-btn">DRAFT</button>
      <button class="bv-key bv-compare-btn" id="bv-compare-btn" title="Score one hand with several builds">COMPARE</button>
      <button class="bv-key" id="bv-zoom-out" title="smaller">&minus;</button>
      <button class="bv-key" id="bv-zoom-in" title="bigger">+</button>
    </div>
    <div class="bv-filters" id="bv-filters"></div>
    <div class="bv-body">
      <div class="bv-rail" id="bv-rail"></div>
      <div class="bv-scroll" id="bv-scroll"><div class="bv-canvas" id="bv-canvas"></div></div>
      <div class="bv-jump" id="bv-jump"></div>
    </div>`;
  document.body.appendChild(el);
  const q = el.querySelector('#bv-q');
  q.value = bv.q || '';
  q.oninput = () => { bv.q = q.value; renderBuildsCanvas(); };
  q.onkeydown = e => { if (e.key === 'Escape') { q.value = ''; bv.q = ''; renderBuildsCanvas(); } };
  el.querySelector('#bv-zoom-in').onclick = () => bvZoom(1.15);
  el.querySelector('#bv-zoom-out').onclick = () => bvZoom(1 / 1.15);
  el.querySelector('#bv-rail-btn').onclick = () => el.classList.toggle('rail-open');
  el.querySelector('#bv-compare-btn').onclick = () => { if (typeof bcOpen === 'function') bcOpen(); };
  // The jump strip follows the scroll: the section in view is lit.
  el.querySelector('#bv-scroll').addEventListener('scroll', bvJumpSync, { passive: true });
  // A click anywhere but a dropdown closes the open one.
  el.addEventListener('pointerdown', e => { if (!e.target.closest('.bv-dd')) el.querySelectorAll('.bv-dd.open').forEach(d => d.classList.remove('open')); });
  // Keys: / focuses the search; Escape closes a dropdown, else clears the search, else leaves.
  document.addEventListener('keydown', e => {
    if (!buildsOpen) return;
    const typing = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
    if (e.key === '/' && !typing) { e.preventDefault(); q.focus(); q.select(); }
    else if (e.key === 'Escape') {
      const open = el.querySelector('.bv-dd.open');
      if (open) open.classList.remove('open');
      else if (bv.q) { q.value = ''; bv.q = ''; renderBuildsCanvas(); }
      else if (!typing) closeBuilds();
    }
  });
  return el;
}
function bvZoom(m) {
  bv.zoom = Math.max(0.5, Math.min(1.6, Math.round(bv.zoom * m * 100) / 100));
  document.getElementById('bv-canvas').style.zoom = bv.zoom;
  bvSave();
}

// ── render ──────────────────────────────────────────────────────────────────
function renderBuilds() {
  renderBuildsFilters();
  renderBuildsRail();
  renderBuildsCanvas();
}

// The filter bar: one dropdown per group, each option with the count it would
// leave on screen given every OTHER dropdown (so a count never reads 0 for the
// thing you just ticked), then GROUP BY and CLEAR.
function renderBuildsFilters() {
  const bar = document.getElementById('bv-filters'); if (!bar) return;
  const groups = [
    { g: 'type', label: 'TYPE', opts: ['trick', ...((typeof anyPairDiscovered === 'function' && anyPairDiscovered()) ? ['inseparable'] : []), 'sleight', 'knack'].map(t => [t, entityLabel(t, true)]) },   // r651: INSEPARABLE once a pair has been made
    { g: 'rar',  label: 'RARITY', opts: BV_RARITIES.map(r => [r, tierLabel('trick', r), 'r-' + r]) },
    { g: 'file', label: 'FILE', opts: BV_FILE },
    ...TAG_GROUPS.map(tg => ({ g: tg.id, label: tg.label, note: tg.note, opts: tagsInGroup(tg.id).map(d => [d.id, d.label, d.cls]) })),
    { g: 'act',  label: 'SLEIGHT', note: 'how a Sleight fires', opts: BV_ACTS },
  ];
  const dd = groups.map(G => {
    const base = bvAll.filter(x => bvPassAll(x, G.g));
    const counts = {};
    base.forEach(x => bvGroupValues(x, G.g).forEach(v => { counts[v] = (counts[v] || 0) + 1; }));
    const on = bv.f[G.g] || [];
    const rows = G.opts.filter(([v]) => counts[v] || on.includes(v)).map(([v, label, cls]) =>
      `<label class="bv-opt ${on.includes(v) ? 'on' : ''}"><input type="checkbox" data-g="${G.g}" data-v="${v}" ${on.includes(v) ? 'checked' : ''}>
         <span class="${cls ? 'kw ' + cls : ''}">${label}</span><i>${counts[v] || 0}</i></label>`).join('');
    if (!rows) return '';
    return `<div class="bv-dd ${on.length ? 'lit' : ''}" data-g="${G.g}">
      <button class="bv-dd-btn">${G.label}${on.length ? `<b>${on.length}</b>` : ''}<em>&#9662;</em></button>
      <div class="bv-dd-menu">${G.note ? `<div class="bv-dd-note">${G.note}</div>` : ''}${rows}
        ${on.length ? `<button class="bv-dd-clear" data-g="${G.g}">clear</button>` : ''}</div></div>`;
  }).join('');
  const groupOpts = [['rarity', 'Rarity'], ['type', 'Type'], ['alpha', 'A to Z'], ['pays', 'Pays'], ['scope', 'Scope'], ['when', 'When'], ['how', 'How'], ['act', 'Sleight']];
  bar.innerHTML = `<span class="bv-f-word">SHOW</span>${dd}
    <span class="bv-f-word bv-f-group">GROUP BY</span>
    <div class="bv-dd" id="bv-group-dd"><button class="bv-dd-btn">${groupOpts.find(o => o[0] === bv.group)[1].toUpperCase()}<em>&#9662;</em></button>
      <div class="bv-dd-menu">${groupOpts.map(([v, l]) => `<label class="bv-opt ${bv.group === v ? 'on' : ''}"><input type="radio" name="bv-group" value="${v}" ${bv.group === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
    <button class="bv-key bv-clear-all" id="bv-clear-all" ${Object.values(bv.f).some(a => a.length) || bv.q ? '' : 'disabled'}>CLEAR</button>
    <div class="bv-active">${groups.flatMap(G => (bv.f[G.g] || []).map(v => { const o = G.opts.find(x => x[0] === v); return `<button class="bv-achip ${o && o[2] ? 'kw ' + o[2] : ''}" data-g="${G.g}" data-v="${v}">${o ? o[1] : v}<i>&#10005;</i></button>`; })).join('')}</div>`;
  bar.querySelectorAll('.bv-achip').forEach(b => b.onclick = () => { const l = bv.f[b.dataset.g]; const i = l.indexOf(b.dataset.v); if (i >= 0) l.splice(i, 1); bvSave(); renderBuildsFilters(); renderBuildsCanvas(); });

  bar.querySelectorAll('.bv-dd-btn').forEach(b => b.onclick = e => {
    const d = b.parentElement, was = d.classList.contains('open');
    bar.querySelectorAll('.bv-dd.open').forEach(o => o.classList.remove('open'));
    if (!was) d.classList.add('open');
    e.stopPropagation();
  });
  bar.querySelectorAll('input[type=checkbox]').forEach(c => c.onchange = () => {
    const list = bv.f[c.dataset.g];
    const i = list.indexOf(c.dataset.v);
    if (c.checked && i < 0) list.push(c.dataset.v); else if (!c.checked && i >= 0) list.splice(i, 1);
    bvSave();
    const open = c.closest('.bv-dd').dataset.g;
    renderBuildsFilters(); renderBuildsCanvas();
    bar.querySelector(`.bv-dd[data-g="${open}"]`)?.classList.add('open');
  });
  bar.querySelectorAll('.bv-dd-clear').forEach(b => b.onclick = () => { bv.f[b.dataset.g] = []; bvSave(); renderBuildsFilters(); renderBuildsCanvas(); });
  bar.querySelectorAll('input[name=bv-group]').forEach(r => r.onchange = () => { bv.group = r.value; bvSave(); renderBuildsFilters(); renderBuildsCanvas(); });
  bar.querySelector('#bv-clear-all').onclick = () => {
    for (const g in bv.f) bv.f[g] = [];
    bv.q = ''; const q = document.getElementById('bv-q'); if (q) q.value = '';
    bvSave(); renderBuildsFilters(); renderBuildsCanvas();
  };
}

function renderBuildsCanvas() {
  const canvas = document.getElementById('bv-canvas'); if (!canvas) return;
  canvas.style.zoom = bv.zoom;
  const shown = bvShown();
  const open = bvAll.filter(x => x.state === 'open').length;
  document.getElementById('bv-count').textContent = `${shown.length} of ${bvAll.length} shown · ${open} found`;
  const groups = bvGroupsOf(shown);
  canvas.innerHTML = groups.length
    ? groups.map(g => `<section class="bv-group">
        <div class="bv-group-label ${g.cls}"><span>${g.label}</span><i>${g.items.length}</i></div>
        <div class="bv-group-items">${g.items.map(x => bvRecordHTML(x)).join('')}</div></section>`).join('')
    : `<div class="bv-none">NOTHING MATCHES. Untick a filter or clear the search.</div>`;
  canvas.querySelectorAll('.bv-entity').forEach(el => {
    const x = bvFind(el.dataset.type, el.dataset.id);
    el.querySelector('.bv-add')?.addEventListener('click', e => { e.stopPropagation(); toggleDraftEntity(x.type, x.id); });
    el.querySelector('.bv-lad')?.addEventListener('click', e => { e.stopPropagation(); bvLadders.has(x.id) ? bvLadders.delete(x.id) : bvLadders.add(x.id); renderBuildsCanvas(); });
    el.addEventListener('click', () => { if (!bv.syn) return; bvPinned = bvPinned === x.id ? null : x.id; bvPaintSynergy(); });
  });
  fitEntityNames(canvas, '.bv-name', { maxLines: 2 });
  bvPaintSynergy();
  bvJumpRender(groups);
}

// ── the section jump strip (r640) ───────────────────────────────────────────
// One key per group on the right edge of the canvas; a tap scrolls the group's
// label to the top, the group in view is lit as you scroll.
function bvJumpRender(groups) {
  const j = document.getElementById('bv-jump'); if (!j) return;
  j.innerHTML = groups.length > 1 ? groups.map((g, i) => `<button class="bv-jkey ${g.cls}" data-i="${i}" title="${g.label} (${g.items.length})">${bv.group === 'alpha' ? g.label : g.label.slice(0, 3)}</button>`).join('') : '';
  j.querySelectorAll('.bv-jkey').forEach(b => b.onclick = () => {
    const sec = document.querySelectorAll('#bv-canvas .bv-group')[+b.dataset.i]; if (!sec) return;
    const sc = document.getElementById('bv-scroll');
    sc.scrollTo({ top: sec.offsetTop * bv.zoom - 6, behavior: 'smooth' });
  });
  bvJumpSync();
}
function bvJumpSync() {
  const sc = document.getElementById('bv-scroll'), j = document.getElementById('bv-jump'); if (!sc || !j) return;
  const secs = [...document.querySelectorAll('#bv-canvas .bv-group')];
  let at = 0;
  secs.forEach((s, i) => { if (s.offsetTop * bv.zoom <= sc.scrollTop + sc.clientHeight * 0.3) at = i; });
  j.querySelectorAll('.bv-jkey').forEach((b, i) => b.classList.toggle('on', i === at));
}

function bvTile(x) {
  const uses = x.type === 'sleight' && x.e.durability != null ? (x.e.durability === 'infinite' ? '∞' : x.e.durability + 'x') : undefined;
  const g = x.type === 'trick' ? trickEmoji(x.e) : (x.e.emoji || (x.type === 'knack' ? '♦' : '🃏'));
  return `<span class="bv-tile">${entityTileHTML({ entity: x.type, emoji: g, label: x.name, uses }, x.rar, { tip: false })}</span>`;
}
function bvTagChips(x) {
  return x.tags.map(t => tagDef(t)).filter(Boolean).map(d => `<span class="bv-chip kw ${d.cls}" title="${d.def}">${d.label}</span>`).join('');
}
function bvRecordHTML(x) {
  const inDraft = draftBuildHas(x.type, x.id);
  const cls = ['bv-entity', 'r-' + x.rar, 't-' + x.type, 'st-' + x.state, inDraft ? 'in-draft' : ''].filter(Boolean).join(' ');
  const head = `<div class="bv-head">${bvTile(x)}<span class="bv-head-text"><span class="bv-name">${x.name}</span>
      <span class="bv-rar">${tierLabel(x.type, x.rar)} ${entityLabel(x.type, false)}${x.act ? ' · ' + BV_ACT_LABEL[x.act] : ''}</span></span></div>`;
  if (x.state === 'missing')
    return `<div class="${cls}" data-type="${x.type}" data-id="${x.id}">${head}
      <div class="bv-note">FILE MISSING<small>take it in a run to read it</small></div></div>`;
  if (x.state === 'classified')
    return `<div class="${cls}" data-type="${x.type}" data-id="${x.id}">${head}
      <div class="bv-note bv-note-red">LOCKED<small>${lockTaskFor(x.id) || 'clearance pending'}</small></div></div>`;
  let extra = '';
  if (bv.odds) { const o = bvOdds(x); extra += `<div class="bv-line bv-odds">1 in ${o.oneIn} ${entityLabel(x.type, false)} offers <i>(${tierLabel(x.type, x.rar)} ${o.tierPct}% over ${o.peers})</i></div>`; }
  if (bv.stats) { const s = bvStatsFor(x); extra += `<div class="bv-line bv-stats">${s ? `taken in ${s.runs} run${s.runs === 1 ? '' : 's'} · ${s.wins} won · best ${s.best.toLocaleString()}` : 'never taken'}</div>`; }
  const ladder = bvLadders.has(x.id) ? bvLadderHTML(x) : '';
  return `<div class="${cls}" data-type="${x.type}" data-id="${x.id}">${head}
    <div class="bv-desc">${highlightKeywords(x.desc)}</div>
    <div class="bv-chips">${bvTagChips(x)}</div>${extra}${ladder}
    <div class="bv-keys">
      <button class="bv-key bv-add ${inDraft ? 'on' : ''}">${inDraft ? '&#10003; IN DRAFT' : '+ DRAFT'}</button>
      <button class="bv-key bv-lad ${bvLadders.has(x.id) ? 'on' : ''}" title="improvement tiers">v2..v5</button>
    </div></div>`;
}

// The improvement ladder (js/improve.js): the description at tiers 1 to 4,
// read by applying each tier for a moment and restoring. Tier 5 stays hidden
// until the player has taken that entity to v6 in a run (owner).
function bvLadderHTML(x) {
  if (typeof canImprove !== 'function' || !(IMPROVE_PLAN[x.id] || improveStepsFor(x.id)))
    return `<div class="bv-ladder"><div class="bv-lrow bv-ldim">Cannot be improved.</div></div>`;
  const was = entityTierOf(x.id);
  const rows = [];
  for (let t = 1; t <= 4; t++) {
    // r651 (owner): a tier reads only once it has been reached in a run (improveTierSeen; dev reveal shows all).
    if (!(typeof improveTierSeen === 'function' && improveTierSeen(x.id, t)) && !(typeof devRevealAll !== 'undefined' && devRevealAll)) {
      rows.push(`<div class="bv-lrow bv-ldim"><b>v${t + 1}</b><span>Not reached yet. Improve this in a run to v${t + 1} to read it.</span></div>`); continue;
    }
    entityTier[x.id] = t; applyEntityTiers();
    const d = (TRICK_POOL_ALL.find(e => e.id === x.id) || SLEIGHT_POOL.find(e => e.id === x.id) || KNACK_POOL.find(e => e.id === x.id) || {}).desc || '';
    rows.push(`<div class="bv-lrow"><b>v${t + 1}</b><span>${highlightKeywords(d)}</span></div>`);
  }
  entityTier[x.id] = was; applyEntityTiers();
  const seen = ((typeof improveTierSeen === 'function') && improveTierSeen(x.id, 5)) || (typeof devRevealAll !== 'undefined' && devRevealAll);
  rows.push(seen
    ? (() => { entityTier[x.id] = 5; applyEntityTiers(); const d = (TRICK_POOL_ALL.find(e => e.id === x.id) || SLEIGHT_POOL.find(e => e.id === x.id) || KNACK_POOL.find(e => e.id === x.id) || {}).desc || ''; entityTier[x.id] = was; applyEntityTiers(); const nm = (typeof V6_NAMES !== 'undefined' && V6_NAMES[x.id]) ? `<i>${V6_NAMES[x.id]}.</i> ` : ''; return `<div class="bv-lrow"><b>v6</b><span>${nm}${highlightKeywords(d)}</span></div>`; })()
    : `<div class="bv-lrow bv-ldim"><b>v6</b><span>Not discovered yet. Improve this in a run to v6 to read it.</span></div>`);
  return `<div class="bv-ladder">${rows.join('')}</div>`;
}

function bvPaintSynergy() {
  const canvas = document.getElementById('bv-canvas'); if (!canvas) return;
  const on = bv.syn && bvPinned;
  canvas.classList.toggle('bv-syn', !!on);
  const pin = on ? bvAll.find(x => x.id === bvPinned) : null;
  canvas.querySelectorAll('.bv-entity').forEach(el => {
    const x = bvFind(el.dataset.type, el.dataset.id);
    el.classList.toggle('syn-pin', !!pin && x === pin);
    el.classList.toggle('syn-hit', !!pin && x !== pin && bvSynergy(pin, x) >= 2);
  });
}

// ── the draft build (left rail) ─────────────────────────────────────────────
function draftListFor(type) {
  return type === 'trick' ? draftBuild.tricks : type === 'sleight' ? draftBuild.sleights : type === 'knack' ? draftBuild.knacks : null;
}
function draftBuildHas(type, id) { const l = draftListFor(type); return !!l && l.includes(id); }
function toggleDraftEntity(type, id) {
  const list = draftListFor(type); if (!list) return;
  if (fileState(id) !== 'open') { showBuildsToast('Take it in a run first'); return; }
  const at = list.indexOf(id);
  if (at >= 0) list.splice(at, 1); else list.push(id);
  renderBuildsRail(); renderBuildsCanvas();
}
// What a run would refuse or not allow: more Tricks than the starting slots,
// two Focus knacks (one at a time, js/focus-knacks.js), a retired entity.
function draftWarnings() {
  const w = [];
  const slots = (typeof LIMITS_DEF !== 'undefined' && LIMITS_DEF.find(d => d.id === 'trick_slots')) || { base: 5, max: 10 };
  if (draftBuild.tricks.length > slots.base) w.push(`${draftBuild.tricks.length} Tricks need ${draftBuild.tricks.length} Trick Slots; a run starts with ${slots.base}${draftBuild.tricks.length > slots.max ? ', the most is ' + slots.max : ''}.`);
  if (typeof FOCUS_TAP_KNACKS !== 'undefined') {
    const fk = draftBuild.knacks.filter(id => FOCUS_TAP_KNACKS[id]);
    if (fk.length > 1) w.push(`Focus knacks come one at a time: ${fk.map(id => KNACK_POOL.find(k => k.id === id)?.name).join(', ')}.`);
  }
  draftBuild.tricks.forEach(id => { const t = TRICK_POOL_ALL.find(e => e.id === id); if (t && t.retired) w.push(`${t.name} is no longer offered.`); });
  return w;
}
function renderBuildsRail() {
  const el = document.getElementById('bv-rail'); if (!el) return;
  const row = (ids, type, empty) => ids.length
    ? ids.map(id => { const x = bvFind(type, id); if (!x) return '';
        return `<div class="bv-mini r-${x.rar}" data-type="${type}" data-id="${id}" title="${x.name} (tap to remove)">${bvTile(x)}</div>`; }).join('')
    : `<span class="bv-empty">${empty}</span>`;
  const n = draftBuild.tricks.length + draftBuild.sleights.length + draftBuild.knacks.length;
  const warns = draftWarnings();
  const rb = document.getElementById('bv-rail-btn'); if (rb) rb.textContent = n ? `DRAFT ${n}` : 'DRAFT';
  el.innerHTML = `
    <div class="bv-screen">
      <div class="bv-pt">DRAFT BUILD <span>${n}</span></div>
      <div class="bv-prow p-tricks"><em>${entityLabel('trick', true)}</em>${row(draftBuild.tricks, 'trick', 'none')}</div>
      <div class="bv-prow p-sleights"><em>${entityLabel('sleight', true)}</em>${row(draftBuild.sleights, 'sleight', 'none')}</div>
      <div class="bv-prow p-knacks"><em>${entityLabel('knack', true)}</em>${row(draftBuild.knacks, 'knack', 'none')}</div>
      ${warns.length ? `<div class="bv-warn">${warns.map(w => `<div>&#9888; ${w}</div>`).join('')}</div>` : ''}
      <input id="bv-name" class="bv-name-in" placeholder="build name" value="${(draftBuild.name || '').replace(/"/g, '&quot;')}">
      <div class="bv-actions">
        <button class="bv-key" id="bv-save">SAVE</button>
        <button class="bv-key bv-track" id="bv-file" title="Stars these wherever a run offers them">TRACK IN RUNS</button>
        <button class="bv-key bv-drive" id="bv-drive" title="One round of Classic with this build granted">TEST DRIVE</button>
        <button class="bv-key" id="bv-share">COPY CODE</button>
        <button class="bv-key" id="bv-load">PASTE CODE</button>
        <button class="bv-key bv-clear-b" id="bv-clear-draft">CLEAR</button>
      </div>
    </div>
    <div class="bv-screen" id="bv-saved"></div>
    <div class="bv-screen"><button class="bv-key bv-compare-k" id="bv-compare-k" title="Score one hand with several builds">COMPARE BUILDS</button></div>
    <div class="bv-screen">
      <div class="bv-pt">VIEW</div>
      <label class="bv-tog ${bv.syn ? 'on' : ''}"><input type="checkbox" id="bv-syn" ${bv.syn ? 'checked' : ''}><span>Highlight potential synergies</span><small>tap a record; what shares its conditions lights up</small></label>
      <label class="bv-tog ${bv.odds ? 'on' : ''}"><input type="checkbox" id="bv-odds" ${bv.odds ? 'checked' : ''}><span>Show offer odds</span><small>how often one offer of its type is this, with no Luck</small></label>
      <label class="bv-tog ${bv.stats ? 'on' : ''}"><input type="checkbox" id="bv-stats" ${bv.stats ? 'checked' : ''}><span>Show my run stats</span><small>runs taken and won, from your history</small></label>
      <label class="bv-tog ${bv.hidden ? 'on' : ''}"><input type="checkbox" id="bv-hidden" ${bv.hidden ? 'checked' : ''}><span>Show unfound and locked files</span></label>
    </div>`;
  el.querySelectorAll('.bv-mini').forEach(m => m.onclick = () => toggleDraftEntity(m.dataset.type, m.dataset.id));
  el.querySelector('#bv-name').oninput = e => { draftBuild.name = e.target.value; };
  el.querySelector('#bv-save').onclick = saveDraftBuild;
  el.querySelector('#bv-file').onclick = fileDraftWithProcurement;
  el.querySelector('#bv-drive').onclick = testDriveDraft;
  el.querySelector('#bv-share').onclick = copyBuildShareCode;
  el.querySelector('#bv-load').onclick = pasteBuildShareCode;
  el.querySelector('#bv-clear-draft').onclick = () => { draftBuild = { name: '', tricks: [], sleights: [], knacks: [] }; renderBuildsRail(); renderBuildsCanvas(); };
  el.querySelector('#bv-compare-k').onclick = () => { if (typeof bcOpen === 'function') bcOpen(); };
  const tog = (id, key, after) => { el.querySelector('#' + id).onchange = e => { bv[key] = e.target.checked; bvSave(); if (!bv.syn) bvPinned = null; renderBuildsRail(); after(); }; };
  tog('bv-syn', 'syn', bvPaintSynergy);
  tog('bv-odds', 'odds', renderBuildsCanvas);
  tog('bv-stats', 'stats', renderBuildsCanvas);
  tog('bv-hidden', 'hidden', () => { renderBuildsFilters(); renderBuildsCanvas(); });
  renderSavedBuilds();
}

// ── save / share / track ────────────────────────────────────────────────────
function loadSavedBuilds() {
  try { const r = JSON.parse(localStorage.getItem('savedBuilds') || '[]'); return Array.isArray(r) ? r : []; }
  catch (e) { return []; }
}
function persistSavedBuilds(list) {
  try { localStorage.setItem('savedBuilds', JSON.stringify(list)); } catch (e) {}
}
// Also the one write for a build saved from the finale (js/finale.js).
function saveBuildRecord(rec) {
  const list = loadSavedBuilds();
  const name = (rec.name || '').trim() || `Build ${list.length + 1}`;
  const out = { name, tricks: [...(rec.tricks || [])], sleights: [...(rec.sleights || [])], knacks: [...(rec.knacks || [])] };
  const i = list.findIndex(b => b.name === name);
  if (i >= 0) list[i] = { ...list[i], ...out }; else list.push(out);
  persistSavedBuilds(list);
  return out;
}
function saveDraftBuild() {
  const total = draftBuild.tricks.length + draftBuild.sleights.length + draftBuild.knacks.length;
  if (!total) { showBuildsToast('Nothing in the draft yet'); return null; }
  const rec = saveBuildRecord(draftBuild);
  draftBuild.name = rec.name;
  showBuildsToast(`Saved “${rec.name}”`);
  renderBuildsRail();
  return rec;
}
// Tracking marks one saved build as THE goal: a run stars its entities on every
// offer (entityTileHTML reads isRequisitioned).
function fileDraftWithProcurement() {
  const rec = saveDraftBuild(); if (!rec) return;
  try { localStorage.setItem('filedRequisition', rec.name); } catch (e) {}
  showBuildsToast(`Tracking “${rec.name}” in runs`);
  renderSavedBuilds();
}
function filedRequisitionName() { return localStorage.getItem('filedRequisition') || ''; }
function setFiledRequisition(name) { try { if (name) localStorage.setItem('filedRequisition', name); else localStorage.removeItem('filedRequisition'); } catch (e) {} }
function filedRequisition() {
  const n = filedRequisitionName();
  return n ? loadSavedBuilds().find(b => b.name === n) || null : null;
}
// Read by entityTileHTML: a wanted entity wears a star wherever a run offers it.
function isRequisitioned(id) {
  const b = filedRequisition();
  return !!b && (b.tricks.includes(id) || b.sleights.includes(id) || b.knacks.includes(id));
}

function renderSavedBuilds() {
  const el = document.getElementById('bv-saved'); if (!el) return;
  const list = loadSavedBuilds(), filed = filedRequisitionName();
  if (!list.length) { el.innerHTML = `<div class="bv-pt">SAVED BUILDS</div><div class="bv-empty">none yet</div>`; return; }
  el.innerHTML = `<div class="bv-pt">SAVED BUILDS <span>${list.length}</span></div>` + list.map((b, i) => {
    const n = b.tricks.length + b.sleights.length + b.knacks.length;
    return `<div class="bv-saved-row ${b.name === filed ? 'filed' : ''}">
      <button class="bv-saved-name" data-i="${i}">${b.name === filed ? '&#9733; ' : ''}${b.name}<small>${n}</small></button>
      <button class="bv-saved-del" data-d="${i}" title="delete">&#10005;</button></div>`;
  }).join('');
  el.querySelectorAll('.bv-saved-name').forEach(b => b.onclick = () => {
    const rec = loadSavedBuilds()[+b.dataset.i]; if (!rec) return;
    draftBuild = { name: rec.name, tricks: [...rec.tricks], sleights: [...rec.sleights], knacks: [...rec.knacks] };
    renderBuildsRail(); renderBuildsCanvas();
  });
  el.querySelectorAll('.bv-saved-del').forEach(b => b.onclick = () => {
    const list2 = loadSavedBuilds(); const rec = list2[+b.dataset.d];
    list2.splice(+b.dataset.d, 1); persistSavedBuilds(list2);
    if (rec && rec.name === filedRequisitionName()) setFiledRequisition('');
    renderSavedBuilds();
  });
}

// Share code: a compact, pasteable string. Ids are kept verbatim so a code
// survives pool reordering.
function encodeBuild(b) {
  const body = ['T:' + b.tricks.join(','), 'S:' + b.sleights.join(','), 'K:' + b.knacks.join(',')].join('|');
  return 'LETHE-' + btoa(unescape(encodeURIComponent((b.name || 'build') + '|' + body))).replace(/=+$/, '');
}
function decodeBuild(code) {
  try {
    const raw = decodeURIComponent(escape(atob(String(code).trim().replace(/^LETHE-/, ''))));
    const [name, t, s, k] = raw.split('|');
    const grab = (seg, p) => (seg || '').startsWith(p) ? seg.slice(p.length).split(',').filter(Boolean) : [];
    return { name: name || 'shared build', tricks: grab(t, 'T:'), sleights: grab(s, 'S:'), knacks: grab(k, 'K:') };
  } catch (e) { return null; }
}
function copyBuildShareCode() {
  const code = encodeBuild(draftBuild);
  const done = () => showBuildsToast('Code copied');
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(code).then(done, () => prompt('Share code:', code));
  else prompt('Share code:', code);
}
function pasteBuildShareCode() {
  const code = prompt('Paste a LETHE build code:');
  if (!code) return;
  const b = decodeBuild(code);
  if (!b) { showBuildsToast('That code did not parse'); return; }
  draftBuild = b;
  showBuildsToast(`Loaded “${b.name}”`);
  renderBuildsRail(); renderBuildsCanvas();
}

// ── test drive (owner: one round only) ──────────────────────────────────────
// Reloads like NEW RUN (js/game-control.js) with a note; bootstrap starts a
// Classic run, the draft is granted at the first round's start, the walkthrough
// stands down, and the round's end (goal or clock) opens the finale instead of
// the interlude (js/finale.js reads testDriveActive()).
const TEST_DRIVE_KEY = 'lethe.testDrive.v1';
let testDrive = null;
function testDriveDraft() {
  const n = draftBuild.tricks.length + draftBuild.sleights.length + draftBuild.knacks.length;
  if (!n) { showBuildsToast('Nothing in the draft yet'); return; }
  if (!confirm('Test drive: one round of Classic with this build granted. Ready?')) return;
  try { sessionStorage.setItem(TEST_DRIVE_KEY, JSON.stringify({ name: draftBuild.name, tricks: draftBuild.tricks, sleights: draftBuild.sleights, knacks: draftBuild.knacks })); } catch (e) {}
  location.reload();
}
function takeTestDriveRequest() {
  try {
    const raw = sessionStorage.getItem(TEST_DRIVE_KEY);
    sessionStorage.removeItem(TEST_DRIVE_KEY);
    const req = raw ? JSON.parse(raw) : null;
    return req && (req.tricks || req.knacks || req.sleights) ? req : null;
  } catch (e) { return null; }
}
function testDriveActive() { return !!testDrive; }
function launchTestDrive(req) {
  testDrive = req;
  ACTIVE_MODE = MODES.normal;
  startGame();
  try { if (typeof tutorialEnd === 'function' && typeof tutorialActive === 'function' && tutorialActive()) tutorialEnd(); } catch (e) {}
  // Grant after the deal so the tray and the deck exist. Sleights go to the TOP
  // of the draw pile so they reach the board this round.
  setTimeout(() => {
    try {
      (req.tricks || []).forEach(id => { const t = TRICK_POOL_ALL.find(e => e.id === id); if (t) injectTrickAfterReward({ ...t }); });
      (req.knacks || []).forEach(id => { const k = KNACK_POOL.find(e => e.id === id); if (k && !hasKnack(id)) acquiredKnacks.push({ ...k }); });
      if (typeof updateKnackList === 'function') updateKnackList();
      (req.sleights || []).forEach(id => { const s = SLEIGHT_POOL.find(e => e.id === id); if (!s) return; grantSleight(s); const c = drawPile.pop(); if (c) drawPile.unshift(c); });
      if (typeof recomputeFocusDecayInterval === 'function') recomputeFocusDecayInterval();
      if (typeof renderTrickTray === 'function') renderTrickTray();
      syncDiscoveredFromOwned();
      showMessage('TEST DRIVE: one round', 'var(--c-mint)');
    } catch (e) { console.error('[test drive] grant failed', e); }
  }, 600);
}

let _bvToast = null;
function showBuildsToast(msg) {
  if (!_bvToast) { _bvToast = document.createElement('div'); _bvToast.id = 'bv-toast'; document.body.appendChild(_bvToast); }
  _bvToast.textContent = msg;
  _bvToast.classList.add('show');
  clearTimeout(_bvToast._t);
  _bvToast._t = setTimeout(() => _bvToast.classList.remove('show'), 1900);
}
