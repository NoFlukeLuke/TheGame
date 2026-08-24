// ══════════════════════════════════════════════════════════════════════════
// BUILDS — the LETHE procurement catalogue. Every entity in the game laid out on
// one pannable, zoomable canvas so you can browse the whole catalogue and
// assemble a dream build.
//
// NOT to be confused with the RECORDS hub's "Personnel File" (js/records.js),
// which lists what you own in the CURRENT run. This is the full catalogue of what
// exists, gated by what you've discovered, and it lives on the main menu.
//
// LAYOUT      Grouped by TYPE (Tricks / Sleights / Knacks / Events) always, and
//             sub-grouped within each type by RARITY or by KEYWORD on a toggle.
//             The chosen sub-group's label sits above its cluster.
//
// ZOOM        Two tiers. At/above BUILD_TOOLTIP_ZOOM every record shows its full
//             text; below it, icon + name only. Zooming further out just makes
//             those smaller — nothing is removed, it simply stops being legible.
//
// FILE STATE  Undiscovered entities read as FILE MISSING (a stuck-on note);
//             task-gated ones read as AUTHORIZATION REQUIRED. Both can be hidden.
//
// REQUISITION A saved build can be FILED WITH PROCUREMENT — the corporate way of
//             pinning a goal. Entities on the filed requisition are flagged
//             wherever they appear in a run.
// ══════════════════════════════════════════════════════════════════════════

let buildsOpen      = false;
let buildsGroupMode = localStorage.getItem('buildsGroupMode') || 'rarity';  // 'rarity' | 'keyword'
let buildsFilterMode = localStorage.getItem('buildsFilterMode') || 'highlight'; // 'highlight' | 'isolate'
let buildsShowHidden = localStorage.getItem('buildsShowHidden') !== 'false'; // show FILE MISSING / CLASSIFIED
let buildsActiveKeywords = new Set();
let buildsActiveRarities = new Set();

// canvas transform
let bvX = 0, bvY = 0, bvZoom = 1;
const BUILD_MIN_ZOOM = 0.16, BUILD_MAX_ZOOM = 1.6;
const BUILD_TOOLTIP_ZOOM = 0.62;   // at/above this, full records; below, icon + name

// ── the current draft build ─────────────────────────────────────────────────
let draftBuild = { name: '', tricks: [], sleights: [], knacks: [] };

const BUILD_TYPES = [
  { key:'trick',   label:'TRICKS',   pool:() => TRICK_POOL,   rar:'tier'    },
  { key:'sleight', label:'SLEIGHTS', pool:() => SLEIGHT_POOL, rar:'rarity'  },
  { key:'knack',   label:'KNACKS',   pool:() => KNACK_POOL,   rar:'rarity'  },
  { key:'event',   label:'EVENTS',   pool:() => Object.keys(EVENT_META).map(id => ({
      id, name: EVENT_META[id].name, desc: EVENT_META[id].flavor, rarity:'rare', emoji:'✧' })), rar:'rarity' },
];
const BUILD_RARITIES = ['common','rare','epic','legendary','mythic'];

function buildEntityEmoji(e, type) {
  if (type === 'trick')  return (typeof trickEmoji === 'function') ? trickEmoji(e) : '✦';
  if (type === 'knack')  return e.emoji || '♦';
  if (type === 'sleight')return e.emoji || '🃏';
  return e.emoji || '✧';
}
function buildEntityRarity(e, def) { return e[def.rar] || e.rarity || e.tier || 'common'; }

// ── open / close ────────────────────────────────────────────────────────────
function openBuilds() {
  buildsOpen = true;
  syncDiscoveredFromOwned();
  ensureBuildsOverlay();
  document.getElementById('main-menu-overlay')?.classList.remove('show');
  document.getElementById('builds-overlay').classList.add('show');
  renderBuilds();
  // Start centred on the first section rather than at a corner.
  if (!bvX && !bvY) { bvX = 40; bvY = 40; bvZoom = 0.75; applyBuildsTransform(); }
}
function closeBuilds() {
  buildsOpen = false;
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
      <button class="bv-back" onclick="closeBuilds()">&#9664; MENU</button>
      <span class="bv-title">PROCUREMENT CATALOGUE</span>
      <span class="bv-sub" id="bv-count"></span>
      <div class="bv-bar-right">
        <button class="bv-chip" id="bv-group-btn">GROUP: RARITY</button>
        <button class="bv-chip" id="bv-filter-btn">&#9673; FILTERS</button>
        <button class="bv-chip" id="bv-zoom-out">&minus;</button>
        <span class="bv-zoom" id="bv-zoom-val">75%</span>
        <button class="bv-chip" id="bv-zoom-in">+</button>
      </div>
    </div>

    <div class="bv-body">
      <div class="bv-rail" id="bv-rail"></div>
      <div class="bv-canvas-wrap" id="bv-canvas-wrap">
        <div class="bv-canvas" id="bv-canvas"></div>
      </div>
    </div>

    <div class="bv-filters" id="bv-filters">
      <div class="bv-f-head"><span>FILTERS</span><button class="bv-x" id="bv-filters-close">&#10005;</button></div>
      <div class="bv-f-row">
        <span class="bv-f-label">Matches</span>
        <button class="bv-toggle" id="bv-mode-highlight">HIGHLIGHT</button>
        <button class="bv-toggle" id="bv-mode-isolate">ISOLATE ONLY</button>
      </div>
      <div class="bv-f-row">
        <span class="bv-f-label">Restricted files</span>
        <button class="bv-toggle" id="bv-show-hidden">SHOW</button>
        <button class="bv-toggle" id="bv-hide-hidden">HIDE</button>
      </div>
      <div class="bv-f-sec">RARITY</div>
      <div class="bv-f-tags" id="bv-rar-tags"></div>
      <div class="bv-f-sec">KEYWORD</div>
      <div class="bv-f-tags" id="bv-kw-tags"></div>
      <div class="bv-f-foot"><button class="bv-clear" id="bv-clear-filters">CLEAR ALL</button></div>
    </div>`;
  document.body.appendChild(el);
  bindBuildsControls(el);
  bindBuildsPanZoom(document.getElementById('bv-canvas-wrap'));
  return el;
}

function bindBuildsControls(el) {
  el.querySelector('#bv-group-btn').onclick = () => {
    buildsGroupMode = buildsGroupMode === 'rarity' ? 'keyword' : 'rarity';
    localStorage.setItem('buildsGroupMode', buildsGroupMode);
    renderBuilds();
  };
  const fp = el.querySelector('#bv-filters');
  el.querySelector('#bv-filter-btn').onclick = () => fp.classList.toggle('show');
  el.querySelector('#bv-filters-close').onclick = () => fp.classList.remove('show');
  el.querySelector('#bv-mode-highlight').onclick = () => setBuildsFilterMode('highlight');
  el.querySelector('#bv-mode-isolate').onclick  = () => setBuildsFilterMode('isolate');
  el.querySelector('#bv-show-hidden').onclick = () => setBuildsShowHidden(true);
  el.querySelector('#bv-hide-hidden').onclick = () => setBuildsShowHidden(false);
  el.querySelector('#bv-clear-filters').onclick = () => {
    buildsActiveKeywords.clear(); buildsActiveRarities.clear(); renderBuilds();
  };
  el.querySelector('#bv-zoom-in').onclick  = () => zoomBuilds(1.25);
  el.querySelector('#bv-zoom-out').onclick = () => zoomBuilds(0.8);
}
function setBuildsFilterMode(m) {
  buildsFilterMode = m; localStorage.setItem('buildsFilterMode', m); renderBuilds();
}
function setBuildsShowHidden(on) {
  buildsShowHidden = !!on; localStorage.setItem('buildsShowHidden', on ? 'true' : 'false'); renderBuilds();
}

// ── pan + zoom ──────────────────────────────────────────────────────────────
function applyBuildsTransform() {
  const c = document.getElementById('bv-canvas');
  if (c) c.style.transform = `translate(${bvX}px, ${bvY}px) scale(${bvZoom})`;
  const z = document.getElementById('bv-zoom-val');
  if (z) z.textContent = Math.round(bvZoom * 100) + '%';
  const wrap = document.getElementById('bv-canvas-wrap');
  // The tier switch: one class, so every record shows or hides its text together.
  if (wrap) wrap.classList.toggle('bv-far', bvZoom < BUILD_TOOLTIP_ZOOM);
}
function zoomBuilds(mult, cx, cy) {
  const wrap = document.getElementById('bv-canvas-wrap');
  const r = wrap.getBoundingClientRect();
  const px = cx == null ? r.width / 2  : cx - r.left;
  const py = cy == null ? r.height / 2 : cy - r.top;
  const next = Math.max(BUILD_MIN_ZOOM, Math.min(BUILD_MAX_ZOOM, bvZoom * mult));
  // keep the point under the cursor fixed while scaling
  bvX = px - (px - bvX) * (next / bvZoom);
  bvY = py - (py - bvY) * (next / bvZoom);
  bvZoom = next;
  applyBuildsTransform();
}

function bindBuildsPanZoom(wrap) {
  let drag = null;
  wrap.addEventListener('pointerdown', e => {
    if (e.target.closest('.bv-entity')) return;      // clicking a record isn't a pan
    drag = { x: e.clientX, y: e.clientY, ox: bvX, oy: bvY, id: e.pointerId };
    wrap.classList.add('grabbing');
  });
  document.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    bvX = drag.ox + (e.clientX - drag.x);
    bvY = drag.oy + (e.clientY - drag.y);
    applyBuildsTransform();
  });
  const stop = () => { drag = null; wrap.classList.remove('grabbing'); };
  document.addEventListener('pointerup', stop);
  document.addEventListener('pointercancel', stop);

  wrap.addEventListener('wheel', e => {
    e.preventDefault();
    zoomBuilds(e.deltaY < 0 ? 1.12 : 0.89, e.clientX, e.clientY);
  }, { passive: false });

  // pinch
  const pts = new Map();
  let pinchDist = 0;
  wrap.addEventListener('pointerdown', e => pts.set(e.pointerId, e));
  wrap.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, e);
    if (pts.size !== 2) return;
    const [a, b] = [...pts.values()];
    const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    if (pinchDist) zoomBuilds(d / pinchDist, (a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2);
    pinchDist = d;
  });
  const drop = e => { pts.delete(e.pointerId); if (pts.size < 2) pinchDist = 0; };
  wrap.addEventListener('pointerup', drop);
  wrap.addEventListener('pointercancel', drop);
}

// ── grouping ────────────────────────────────────────────────────────────────
// Type is always the outer grouping. Inside it, either rarity bands or keyword
// clusters — an entity appears under every keyword it mentions, so a card that
// touches both pips and focus shows up in both neighbourhoods on purpose.
function buildsGroupsFor(def) {
  const pool = def.pool();
  if (buildsGroupMode === 'rarity') {
    return BUILD_RARITIES.map(r => ({
      label: r.toUpperCase(),
      cls: 'r-' + r,
      items: pool.filter(e => buildEntityRarity(e, def) === r),
    })).filter(g => g.items.length);
  }
  const by = {};
  pool.forEach(e => {
    const kws = keywordsIn(e.desc || '');
    if (!kws.length) (by['—'] = by['—'] || { label:'NO KEYWORDS', cls:'', items:[] }).items.push(e);
    kws.forEach(k => {
      by[k.key] = by[k.key] || { label: k.name.toUpperCase(), cls: k.cls, items: [] };
      by[k.key].items.push(e);
    });
  });
  return Object.values(by).sort((a, b) => b.items.length - a.items.length);
}

function buildsMatches(e) {
  if (buildsActiveRarities.size) {
    const def = BUILD_TYPES.find(d => d.pool().includes(e));
    const r = def ? buildEntityRarity(e, def) : (e.rarity || e.tier || 'common');
    if (!buildsActiveRarities.has(r)) return false;
  }
  if (buildsActiveKeywords.size) {
    const keys = keywordsIn(e.desc || '').map(k => k.key);
    if (!keys.some(k => buildsActiveKeywords.has(k))) return false;
  }
  return true;
}
function buildsFiltersActive() { return buildsActiveKeywords.size > 0 || buildsActiveRarities.size > 0; }

// ── render ──────────────────────────────────────────────────────────────────
function renderBuilds() {
  const canvas = document.getElementById('bv-canvas');
  if (!canvas) return;
  document.getElementById('bv-group-btn').textContent = 'GROUP: ' + buildsGroupMode.toUpperCase();

  let open = 0, total = 0;
  const html = BUILD_TYPES.map(def => {
    const groups = buildsGroupsFor(def).map(g => {
      const cards = g.items.map(e => {
        total++;
        const st = fileState(e.id);
        if (st === 'open') open++;
        if (!buildsShowHidden && st !== 'open') return '';
        const match = buildsMatches(e);
        if (buildsFiltersActive() && buildsFilterMode === 'isolate' && !match) return '';
        return buildEntityHTML(e, def, st, match);
      }).join('');
      if (!cards) return '';
      return `<div class="bv-group">
        <div class="bv-group-label ${g.cls}">${g.label} <span>${g.items.length}</span></div>
        <div class="bv-group-items">${cards}</div>
      </div>`;
    }).join('');
    return `<section class="bv-section bv-t-${def.key}">
      <div class="bv-sec-head"><span class="bv-sec-title">${def.label}</span>
        <span class="bv-sec-n">${def.pool().length} records</span></div>
      ${groups}
    </section>`;
  }).join('');

  canvas.innerHTML = html;
  document.getElementById('bv-count').textContent = `${open} / ${total} files open`;
  canvas.querySelectorAll('.bv-entity').forEach(el => {
    el.onclick = () => toggleDraftEntity(el.dataset.type, el.dataset.id);
  });
  fitEntityNames(canvas, '.bv-name', { maxLines: 2 });
  renderBuildsRail();
  renderBuildsFilterTags();
  applyBuildsTransform();
}

function buildEntityHTML(e, def, state, match) {
  const rar = buildEntityRarity(e, def);
  const inDraft = draftBuildHas(def.key, e.id);
  const dim = buildsFiltersActive() && buildsFilterMode === 'highlight' && !match;
  const cls = ['bv-entity', 'r-' + rar, 'st-' + state, inDraft ? 'in-draft' : '', dim ? 'dim' : ''].filter(Boolean).join(' ');

  if (state === 'missing') {
    return `<div class="${cls}" data-type="${def.key}" data-id="${e.id}">
      <div class="bv-note"><div class="bv-note-stamp">FILE MISSING</div>
      <div class="bv-note-sub">no record on file — acquire in a run to open</div></div></div>`;
  }
  if (state === 'classified') {
    return `<div class="${cls}" data-type="${def.key}" data-id="${e.id}">
      <div class="bv-note bv-note-red"><div class="bv-note-stamp">AUTHORIZATION<br>REQUIRED</div>
      <div class="bv-note-sub">clearance pending</div></div></div>`;
  }
  return `<div class="${cls}" data-type="${def.key}" data-id="${e.id}">
    <div class="bv-head">
      <span class="bv-emoji">${buildEntityEmoji(e, def.key)}</span>
      <span class="bv-name">${e.name}</span>
    </div>
    <div class="bv-rar">${rar}</div>
    <div class="bv-desc">${highlightKeywords(e.desc || '')}</div>
    ${inDraft ? '<div class="bv-tick">&#10003; ON REQUISITION</div>' : ''}
  </div>`;
}

// ── the draft build (left rail) ─────────────────────────────────────────────
function draftListFor(type) {
  return type === 'trick' ? draftBuild.tricks
       : type === 'sleight' ? draftBuild.sleights
       : type === 'knack' ? draftBuild.knacks : null;
}
function draftBuildHas(type, id) { const l = draftListFor(type); return !!l && l.includes(id); }
function toggleDraftEntity(type, id) {
  const list = draftListFor(type);
  if (!list) { showBuildsToast('Events can’t be requisitioned'); return; }
  if (fileState(id) !== 'open') { showBuildsToast('That file is not open'); return; }
  const at = list.indexOf(id);
  if (at >= 0) list.splice(at, 1); else list.push(id);
  renderBuilds();
}

function renderBuildsRail() {
  const el = document.getElementById('bv-rail'); if (!el) return;
  const find = (pool, id) => pool.find(x => x.id === id);
  const row = (ids, pool, type, empty) => ids.length
    ? ids.map(id => { const e = find(pool, id); if (!e) return '';
        const r = e.tier || e.rarity || 'common';
        return `<div class="bv-mini r-${r}" data-type="${type}" data-id="${id}" title="${e.name}">
          <span>${buildEntityEmoji(e, type)}</span></div>`; }).join('')
    : `<span class="bv-empty">${empty}</span>`;

  el.innerHTML = `
    <div class="bv-panel p-knacks"><div class="bv-pt"><span>Knacks</span><span>${draftBuild.knacks.length}</span></div>
      <div class="bv-prow">${row(draftBuild.knacks, KNACK_POOL, 'knack', 'none selected')}</div></div>
    <div class="bv-panel p-sleights"><div class="bv-pt"><span>Sleights</span><span>${draftBuild.sleights.length}</span></div>
      <div class="bv-prow">${row(draftBuild.sleights, SLEIGHT_POOL, 'sleight', 'none selected')}</div></div>
    <div class="bv-panel p-tricks"><div class="bv-pt"><span>Tricks</span><span>${draftBuild.tricks.length}</span></div>
      <div class="bv-prow">${row(draftBuild.tricks, TRICK_POOL, 'trick', 'none selected')}</div></div>
    <div class="bv-actions">
      <input id="bv-name" class="bv-name-in" placeholder="requisition name" value="${(draftBuild.name||'').replace(/"/g,'&quot;')}">
      <button class="bv-act" id="bv-save">SAVE</button>
      <button class="bv-act bv-file" id="bv-file">FILE WITH PROCUREMENT</button>
      <button class="bv-act" id="bv-share">COPY SHARE CODE</button>
      <button class="bv-act" id="bv-load">PASTE A CODE</button>
      <button class="bv-act bv-clear-b" id="bv-clear-draft">CLEAR</button>
    </div>
    <div class="bv-saved" id="bv-saved"></div>`;

  el.querySelectorAll('.bv-mini').forEach(m => m.onclick = () => toggleDraftEntity(m.dataset.type, m.dataset.id));
  el.querySelector('#bv-name').oninput = e => { draftBuild.name = e.target.value; };
  el.querySelector('#bv-save').onclick   = saveDraftBuild;
  el.querySelector('#bv-file').onclick   = fileDraftWithProcurement;
  el.querySelector('#bv-share').onclick  = copyBuildShareCode;
  el.querySelector('#bv-load').onclick   = pasteBuildShareCode;
  el.querySelector('#bv-clear-draft').onclick = () => {
    draftBuild = { name:'', tricks:[], sleights:[], knacks:[] }; renderBuilds();
  };
  renderSavedBuilds();
}

function renderBuildsFilterTags() {
  const rt = document.getElementById('bv-rar-tags'), kt = document.getElementById('bv-kw-tags');
  if (!rt || !kt) return;
  rt.innerHTML = BUILD_RARITIES.map(r =>
    `<button class="bv-tag r-${r} ${buildsActiveRarities.has(r)?'on':''}" data-r="${r}">${r}</button>`).join('');
  kt.innerHTML = KEYWORD_DEFS.map(d =>
    `<button class="bv-tag ${buildsActiveKeywords.has(d.key)?'on':''}" data-k="${d.key}">
       <span class="kw ${d.cls}">${d.name}</span></button>`).join('');
  rt.querySelectorAll('.bv-tag').forEach(b => b.onclick = () => {
    const r = b.dataset.r;
    buildsActiveRarities.has(r) ? buildsActiveRarities.delete(r) : buildsActiveRarities.add(r);
    renderBuilds();
  });
  kt.querySelectorAll('.bv-tag').forEach(b => b.onclick = () => {
    const k = b.dataset.k;
    buildsActiveKeywords.has(k) ? buildsActiveKeywords.delete(k) : buildsActiveKeywords.add(k);
    renderBuilds();
  });
  document.getElementById('bv-mode-highlight').classList.toggle('on', buildsFilterMode === 'highlight');
  document.getElementById('bv-mode-isolate').classList.toggle('on', buildsFilterMode === 'isolate');
  document.getElementById('bv-show-hidden').classList.toggle('on', buildsShowHidden);
  document.getElementById('bv-hide-hidden').classList.toggle('on', !buildsShowHidden);
}

// ── save / share / file ─────────────────────────────────────────────────────
function loadSavedBuilds() {
  try { const r = JSON.parse(localStorage.getItem('savedBuilds') || '[]'); return Array.isArray(r) ? r : []; }
  catch (e) { return []; }
}
function persistSavedBuilds(list) {
  try { localStorage.setItem('savedBuilds', JSON.stringify(list)); } catch (e) {}
}
function saveDraftBuild() {
  const total = draftBuild.tricks.length + draftBuild.sleights.length + draftBuild.knacks.length;
  if (!total) { showBuildsToast('Nothing on the requisition yet'); return; }
  const list = loadSavedBuilds();
  const name = (draftBuild.name || '').trim() || `Requisition ${list.length + 1}`;
  const existing = list.findIndex(b => b.name === name);
  const rec = { name, tricks:[...draftBuild.tricks], sleights:[...draftBuild.sleights], knacks:[...draftBuild.knacks] };
  if (existing >= 0) list[existing] = { ...list[existing], ...rec }; else list.push(rec);
  persistSavedBuilds(list);
  draftBuild.name = name;
  showBuildsToast(`Saved “${name}”`);
  renderBuilds();
}
// Filing marks one saved build as THE goal. Gameplay reads it via
// isRequisitioned() to flag those entities wherever they turn up.
function fileDraftWithProcurement() {
  saveDraftBuild();
  const name = (draftBuild.name || '').trim();
  if (!name) return;
  try { localStorage.setItem('filedRequisition', name); } catch (e) {}
  showBuildsToast(`“${name}” filed with Procurement`);
  renderSavedBuilds();
}
function filedRequisitionName() { return localStorage.getItem('filedRequisition') || ''; }
function filedRequisition() {
  const n = filedRequisitionName();
  return n ? loadSavedBuilds().find(b => b.name === n) || null : null;
}
// Used by gameplay screens to flag a wanted entity.
function isRequisitioned(id) {
  const b = filedRequisition();
  return !!b && (b.tricks.includes(id) || b.sleights.includes(id) || b.knacks.includes(id));
}

function renderSavedBuilds() {
  const el = document.getElementById('bv-saved'); if (!el) return;
  const list = loadSavedBuilds(), filed = filedRequisitionName();
  if (!list.length) { el.innerHTML = `<div class="bv-saved-empty">No saved requisitions</div>`; return; }
  el.innerHTML = `<div class="bv-saved-head">SAVED</div>` + list.map((b, i) => {
    const n = b.tricks.length + b.sleights.length + b.knacks.length;
    return `<div class="bv-saved-row ${b.name === filed ? 'filed' : ''}">
      <button class="bv-saved-name" data-i="${i}">${b.name === filed ? '★ ' : ''}${b.name}<small>${n} items</small></button>
      <button class="bv-saved-del" data-d="${i}" title="delete">&#10005;</button>
    </div>`;
  }).join('');
  el.querySelectorAll('.bv-saved-name').forEach(b => b.onclick = () => {
    const rec = loadSavedBuilds()[+b.dataset.i]; if (!rec) return;
    draftBuild = { name: rec.name, tricks:[...rec.tricks], sleights:[...rec.sleights], knacks:[...rec.knacks] };
    renderBuilds();
  });
  el.querySelectorAll('.bv-saved-del').forEach(b => b.onclick = () => {
    const list2 = loadSavedBuilds(); const rec = list2[+b.dataset.d];
    list2.splice(+b.dataset.d, 1); persistSavedBuilds(list2);
    if (rec && rec.name === filedRequisitionName()) localStorage.removeItem('filedRequisition');
    renderSavedBuilds();
  });
}

// Share code: a compact, human-pasteable string. Ids are kept verbatim so a code
// stays readable and survives pool reordering (an index-based code would rot the
// moment an entity is added to a pool).
function encodeBuild(b) {
  const body = ['T:' + b.tricks.join(','), 'S:' + b.sleights.join(','), 'K:' + b.knacks.join(',')].join('|');
  return 'LETHE-' + btoa(unescape(encodeURIComponent((b.name || 'build') + '|' + body))).replace(/=+$/, '');
}
function decodeBuild(code) {
  try {
    const raw = decodeURIComponent(escape(atob(String(code).trim().replace(/^LETHE-/, ''))));
    const [name, t, s, k] = raw.split('|');
    const grab = (seg, p) => (seg || '').startsWith(p) ? seg.slice(p.length).split(',').filter(Boolean) : [];
    return { name: name || 'shared build', tricks: grab(t,'T:'), sleights: grab(s,'S:'), knacks: grab(k,'K:') };
  } catch (e) { return null; }
}
function copyBuildShareCode() {
  const code = encodeBuild(draftBuild);
  const done = () => showBuildsToast('Share code copied');
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(code).then(done, () => prompt('Share code:', code));
  else prompt('Share code:', code);
}
function pasteBuildShareCode() {
  const code = prompt('Paste a LETHE share code:');
  if (!code) return;
  const b = decodeBuild(code);
  if (!b) { showBuildsToast('That code didn’t parse'); return; }
  draftBuild = b;
  showBuildsToast(`Loaded “${b.name}”`);
  renderBuilds();
}

let _bvToast = null;
function showBuildsToast(msg) {
  if (!_bvToast) {
    _bvToast = document.createElement('div');
    _bvToast.id = 'bv-toast';
    document.body.appendChild(_bvToast);
  }
  _bvToast.textContent = msg;
  _bvToast.classList.add('show');
  clearTimeout(_bvToast._t);
  _bvToast._t = setTimeout(() => _bvToast.classList.remove('show'), 1900);
}
