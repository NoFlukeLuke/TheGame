// ══════════════════════════════════════════════════════════════════════════
// LETHE MART — the off-grid shop (r127). Built into the game as a full overlay.
// Routed from triggerShop() when USE_MART_SHOP. The old overlay + on-grid shops
// stay as fallbacks. Fancy features (Spotlight / Wheel / Tools / drag-to-freeze)
// are visible but WIP placeholders for now; core buying/reroll/leave is real.
// ══════════════════════════════════════════════════════════════════════════

let USE_MART_SHOP = true;
let martActive    = false;
let martCats      = [];      // e.g. ['tricks','sleights','limits'] — 3 of 4, tricks always featured
let martStock     = {};      // { tricks:[payload…], sleights:[…], limits:[…], knacks:[…] }
let martCart      = [];      // ['tricks-0', 'sleights-2', …] keys into martStock
let martRerollN   = 0;
let _martFloatRAF = null;

// discount: +5% per ADDITIONAL item (2nd, 3rd…); WIP knack raises to 10%; cap = rate × Selection Size.
let MART_DISCOUNT_PER_ITEM = 5;
function martDiscountPct(n) {
  const cap = MART_DISCOUNT_PER_ITEM * (limits.selection ? limits.selection.current : 3);
  return Math.max(0, Math.min(MART_DISCOUNT_PER_ITEM * (n - 1), cap));
}

// ── rarity-weighted picking (same odds as sleights), duplicates ALLOWED ──
const MART_TIERS   = ['common','rare','epic','legendary','mythic'];
const MART_WEIGHTS = [59,28,10,2,1];
function martRollTier() { const r = Math.random()*100; let c=0; for (let i=0;i<MART_WEIGHTS.length;i++){ c+=MART_WEIGHTS[i]; if (r<c) return MART_TIERS[i]; } return 'common'; }
function martPick(pool, tierKey, count) {
  const out = []; if (!pool || !pool.length) return out;
  for (let n=0; n<count; n++) {
    let tier = martRollTier(), cands = pool.filter(x => (x[tierKey]||'common') === tier);
    for (let d = MART_TIERS.indexOf(tier); d>=0 && !cands.length; d--) cands = pool.filter(x => (x[tierKey]||'common') === MART_TIERS[d]);
    if (!cands.length) cands = pool;
    out.push(cands[Math.floor(Math.random()*cands.length)]);   // duplicates allowed
  }
  return out;
}

// ── payload builders (label, rarity, price, buy fn) ──
function martTrickPayload(t){ return { type:'trick', ref:t, label:t.name, desc:t.desc, rarity:t.tier||'common', emoji:trickEmoji(t),
  price:SHOP_TRICK_PRICES[t.tier]||8, buy:()=>injectTrickAfterReward(t) }; }
function martSleightPayload(s){ return { type:'sleight', ref:s, label:s.name, desc:s.desc, rarity:s.rarity||'common', emoji:s.emoji||'🃏',
  uses:(s.durability==='infinite'||s.durability==null)?'∞':`${s.durability}×`, suit:['♦','♥','♣','♠'][Math.floor(Math.random()*4)], rank:['A','K','Q','J','10','9','8','7'][Math.floor(Math.random()*8)],
  price:SHOP_SLEIGHT_PRICES[s.rarity]||12, buy:()=>grantSleight(s) }; }
function martKnackPayload(k){ return { type:'knack', ref:k, label:k.name, desc:k.desc, rarity:k.rarity||'common', emoji:k.emoji,
  price:SHOP_KNACK_PRICE, buy:()=>{ acquiredKnacks.push({...k}); if (typeof updateKnackList==='function') updateKnackList(); } }; }
function martLimitStock(count){
  const elig = LIMITS_DEF.filter(d => limits[d.id].current < limits[d.id].max);
  return shuffle(elig).slice(0, count).map(d => {
    const cur = limits[d.id].current, next = Math.min(limits[d.id].max, cur + (d.step||1));
    return { type:'limit', ref:d, id:d.id, label:d.label, icon:d.icon, desc:d.desc, rarity:'common', cur, next, max:limits[d.id].max,
      price:shopLimitPrice(d), buy:()=>{ incrementLimit(d.id); if (typeof onLimitChanged==='function') onLimitChanged(d.id); } };
  });
}

function buildMartStock() {
  const others = shuffle(['sleights','knacks','limits']).slice(0, 2);   // 3 of 4 (tricks always featured)
  martCats = ['tricks', ...others];
  martStock = {};
  martStock.tricks = martPick(TRICK_POOL, 'tier', 4).map(martTrickPayload);
  if (martCats.includes('sleights')) martStock.sleights = martPick(SLEIGHT_POOL, 'rarity', 4).map(martSleightPayload);
  if (martCats.includes('knacks'))   martStock.knacks   = martPick(KNACK_POOL, 'rarity', 4).map(martKnackPayload);
  if (martCats.includes('limits'))   martStock.limits   = martLimitStock(4);
}

// ── open / close ──
function ensureMartOverlay() {
  let el = document.getElementById('mart-overlay');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'mart-overlay';
  el.innerHTML = `<div class="mart-grid">
    <div class="mart-loadout" id="mart-loadout"></div>
    <div class="mart-main" id="mart-main"></div>
    <div class="mart-checkout" id="mart-checkout"></div>
  </div>`;
  document.body.appendChild(el);
  // limit tooltip element
  const tt = document.createElement('div'); tt.id = 'mart-ltip'; tt.className = 'm-ltip'; tt.style.position='fixed';
  el.appendChild(tt);
  return el;
}
function openMart() {
  martActive = true; martCart = []; martRerollN = 0;
  gameTimerPaused = true;
  try { sfxShopOpen && sfxShopOpen(); } catch(e){}
  buildMartStock();
  const el = ensureMartOverlay();
  renderMart();
  el.classList.add('show');
  startMartFloat();
}
function closeMart() {
  if (!martActive) return;
  martActive = false;
  stopMartFloat();
  document.getElementById('mart-overlay')?.classList.remove('show');
  gameTimerPaused = false;
  if (shopFromNodeFlow) { shopFromNodeFlow = false; drainLevelUpQueue(); }
  else if (typeof render === 'function') render();
}

// ── render ──
const martRar = p => (MART_TIERS.includes(p.rarity) ? p.rarity : 'common');
function martTileHTML(p, key) {
  const inCart = martCart.includes(key);
  const cant = coins < p.price;
  const cls = ['m-item', 'r-'+martRar(p), inCart?'in-cart':'', p._sold?'sold':''].filter(Boolean).join(' ');
  const price = `<div class="price ${cant&&!inCart?'cant':''}">${p._sold?'✓':'💰'+p.price}</div>`;
  let inner;
  if (p.type==='trick')   inner = `<div class="trick"><div class="emblem">✦ TRICK</div><div class="art">${p.emoji}</div><div class="nm">${p.label}</div></div>`;
  else if (p.type==='sleight') inner = `<div class="sleight"><span class="corner ${'♥♦'.includes(p.suit)?'suit-red':'suit-blk'}">${p.rank}${p.suit}</span><span class="corner br ${'♥♦'.includes(p.suit)?'suit-red':'suit-blk'}">${p.rank}${p.suit}</span><div class="art">${p.emoji}</div><div class="nm">${p.label}</div><div class="uses">${p.uses}</div></div>`;
  else if (p.type==='knack') inner = `<div class="mini-knack" style="width:60px;height:60px;--rc:var(--c-${martRar(p)==='common'?'mint':martRar(p)==='rare'?'cyan':martRar(p)==='epic'?'purple':martRar(p)==='legendary'?'yellow':'magenta'})"><span style="font-size:24px">${p.emoji}</span></div><div style="font-size:7px;text-transform:uppercase;text-align:center;margin-top:3px;color:#fff;max-width:64px">${p.label}</div>`;
  else if (p.type==='limit') inner = `<div class="limit"><span class="ico">▲</span><div class="body"><span class="lname">${p.label}</span><span class="lprog">${p.cur} → ${p.next}</span></div></div>`;
  return `<div class="${cls}" data-key="${key}" ${p.type==='knack'?'style="display:flex;flex-direction:column;align-items:center"':''}>${inner}${price}</div>`;
}

function martSectionHTML(cat) {
  const stock = martStock[cat] || [];
  const meta = {
    tricks:   { cls:'m-sec tricks', label:'★ Tricks (featured)' },
    sleights: { cls:'m-sec',        label:'Sleights ▶' },
    knacks:   { cls:'m-sec',        label:'Knacks ♦' },
    limits:   { cls:'m-sec tall',   label:'Limit Upgrades ▲' },
  }[cat];
  const items = stock.map((p,i) => martTileHTML(p, `${cat}-${i}`)).join('');
  return `<div class="${meta.cls}"><div class="m-sh"><span>${meta.label}</span><span class="slots">${stock.length} / ${stock.length} slots</span></div><div class="m-rowc" data-cat="${cat}">${items}</div></div>`;
}

function renderMart() {
  renderMartLoadout();
  renderMartMain();
  renderMartCheckout();
  bindMartItems();
}

function renderMartLoadout() {
  const el = document.getElementById('mart-loadout'); if (!el) return;
  const rc = r => 'var(--c-'+({common:'mint',rare:'cyan',epic:'purple',legendary:'yellow',mythic:'magenta'}[r]||'mint')+')';
  const knacks = (acquiredKnacks||[]).map(k => `<div class="mini-knack" style="--rc:${rc(k.rarity||'common')}"><span>${k.emoji||'♛'}</span></div>`).join('') || '<span class="m-empty">none yet</span>';
  const sleights = (typeof ownedSleightInstances==='function' ? ownedSleightInstances() : []).map(inst => {
    const d = inst.def; return `<div class="mini-sleight r-${MART_TIERS.includes(d.rarity)?d.rarity:'common'}"><span class="c">${d.emoji||'🃏'}</span></div>`;
  }).join('') || '<span class="m-empty">none in deck</span>';
  const trickList = (typeof trickTrayMode!=='undefined' && trickTrayMode) ? (trickTray||[]) : (acquiredTricks||[]);
  const tricks = trickList.map(t => `<div class="mini-trick r-${MART_TIERS.includes(t.tier)?t.tier:'common'}"><span class="a">${trickEmoji(t)}</span></div>`).join('') || '<span class="m-empty">none yet</span>';
  const trickCap = (typeof trickCapacity==='function') ? trickCapacity() : 5;
  el.innerHTML = `
    <div class="m-panel p-knacks"><div class="m-pt"><span>Knacks</span><span class="cnt">${(acquiredKnacks||[]).length}</span></div><div class="m-row">${knacks}</div></div>
    <div class="m-panel p-sleights"><div class="m-pt"><span>Sleights · in deck</span><span class="cnt">${(typeof ownedSleightInstances==='function'?ownedSleightInstances().length:0)}</span></div><div class="m-row">${sleights}</div></div>
    <div class="m-panel p-tricks"><div class="m-pt"><span>Tricks</span><span class="cnt">${trickList.length} / ${trickCap}</span></div><div class="m-row">${tricks}</div></div>
    <div class="m-settings">
      <div class="m-schip" data-act="stats">📊 Stats</div><div class="m-schip" data-act="deck">🃏 Deck</div>
      <div class="m-schip" data-act="time">⏱ Time</div><div class="m-schip" data-act="wip">⚙ More·WIP</div>
    </div>`;
  el.querySelectorAll('.m-schip').forEach(chip => chip.onclick = () => {
    const a = chip.dataset.act;
    if (a==='time' && typeof toggleTimePopup==='function') toggleTimePopup();
    else showMessage('That panel is WIP in the shop', 'var(--cream-dim)');   // stats/deck resume the round — WIP here
  });
}

function renderMartMain() {
  const el = document.getElementById('mart-main'); if (!el) return;
  const feat = `<div class="m-feat">
    <div class="m-special" style="--rc:var(--c-yellow)"><span class="wip">WIP</span><div><div class="stag">★ SPOTLIGHT · 50% OFF</div><div class="sname">Featured item</div><div class="sdesc">A discounted trick / sleight / knack. (coming soon)</div></div></div>
    <div class="m-special" style="--rc:var(--c-magenta)"><span class="wip">WIP</span><div class="m-wheel"></div><div><div class="stag">◎ SPIN · 💰10</div><div class="sdesc">win any item · 1-in-10 jackpot</div></div></div>
    <div class="m-freezer"><span class="wip" style="position:absolute;top:4px;right:5px">WIP</span><div class="fi">❄</div><div class="ft">FREEZER<br>drag to keep</div></div>
  </div>`;
  const sections = martCats.map(martSectionHTML).join('');
  const tools = `<div class="m-sec tall"><div class="m-sh"><span>Tools 🛠</span><span class="slots">WIP</span></div><div class="m-rowc">
    <div class="m-tool"><div class="tt"><span>⚡ Recharge Bay</span><span>WIP</span></div><div class="td">Recharge sleights (built later).</div></div>
    <div class="m-tool"><div class="tt"><span>✦ Trick Tinker</span><span>WIP</span></div><div class="td">Improve a Trick you own (built later).</div></div>
  </div></div>`;
  el.innerHTML = feat + sections + tools;
}

function renderMartCheckout() {
  const el = document.getElementById('mart-checkout'); if (!el) return;
  const lines = martCart.map(key => {
    const [cat,i] = key.split('-'); const p = martStock[cat][+i];
    return `<div class="m-rline" data-key="${key}"><span>${p.emoji||p.icon||'•'} ${p.label}</span><span>💰${p.price} <span class="x">✕</span></span></div>`;
  }).join('') || '';
  const drop = `<div class="m-drop">click items to add<br>(drag-to-cart is WIP)</div>`;
  const base = martCart.reduce((s,key)=>{ const [cat,i]=key.split('-'); return s + martStock[cat][+i].price; }, 0);
  const pct = martDiscountPct(martCart.length);
  const total = Math.round(base * (1 - pct/100));
  const afford = coins >= total && martCart.length>0;
  el.innerHTML = `
    <div class="m-brand">LETHE MART<small>AUTHORIZED TERMINAL</small></div>
    <div class="m-wallet">💰 ${coins}</div>
    <div class="m-ch"><span>🧾 CHECKOUT</span><small>${martCart.length} item${martCart.length!==1?'s':''}</small></div>
    <div class="m-rcpt">${lines}${drop}</div>
    <div class="m-sum">
      <div class="srow"><span>subtotal</span><span>💰${base}</span></div>
      <div class="srow disc"><span>bundle −${pct}% (cap ${MART_DISCOUNT_PER_ITEM*(limits.selection?limits.selection.current:3)}%)</span><span>−💰${base-total}</span></div>
      <div class="grand"><span>total</span><span>${pct>0?`<s>💰${base}</s> `:''}<b>💰${total}</b></span></div>
      <div class="m-buy ${afford?'':'disabled'}" id="mart-buy">CHECKOUT</div>
      <div class="m-foot"><div class="m-fbtn" id="mart-reroll">🎲 Reroll ${8+martRerollN*2}</div><div class="m-fbtn leave" id="mart-leave">⏻ Leave</div></div>
    </div>`;
  el.querySelectorAll('.m-rline').forEach(l => l.onclick = () => martToggleCart(l.dataset.key));
  el.querySelector('#mart-buy').onclick = martCheckout;
  el.querySelector('#mart-reroll').onclick = martReroll;
  el.querySelector('#mart-leave').onclick = closeMart;
}

function bindMartItems() {
  const main = document.getElementById('mart-main'); if (!main) return;
  main.querySelectorAll('.m-item').forEach(it => {
    const key = it.dataset.key;
    it.onclick = () => martToggleCart(key);
    // limit tooltip (always shows current limit)
    const [cat,i] = key.split('-'); const p = martStock[cat][+i];
    if (p.type === 'limit') {
      const tt = document.getElementById('mart-ltip');
      it.onmouseenter = (e) => { tt.innerHTML = `<div class="n">▲ ${p.label}</div><div class="d">now ${p.cur} → ${p.next}</div><div class="s">${p.desc} · max ${p.max}</div>`; placeMartTip(e, tt); tt.classList.add('show'); };
      it.onmousemove  = (e) => placeMartTip(e, tt);
      it.onmouseleave = () => tt.classList.remove('show');
    }
  });
}
function placeMartTip(e, tt) {
  const pad=14, w=tt.offsetWidth, h=tt.offsetHeight;
  let x=e.clientX+pad, y=e.clientY+pad;
  if (x+w>window.innerWidth-8) x=e.clientX-w-pad;
  if (y+h>window.innerHeight-8) y=e.clientY-h-pad;
  tt.style.left=Math.max(8,x)+'px'; tt.style.top=Math.max(8,y)+'px';
}

// ── cart ──
function martToggleCart(key) {
  const [cat,i] = key.split('-'); const p = martStock[cat]?.[+i];
  if (!p || p._sold) return;
  const at = martCart.indexOf(key);
  if (at >= 0) martCart.splice(at,1);
  else {
    if (martCart.length >= (limits.selection?limits.selection.current:3)) { showMessage('Cart is at your Selection Size cap', 'var(--red)'); return; }
    martCart.push(key);
  }
  renderMart();
}
function martCheckout() {
  if (!martCart.length) return;
  const base = martCart.reduce((s,key)=>{ const [cat,i]=key.split('-'); return s + martStock[cat][+i].price; }, 0);
  const total = Math.round(base * (1 - martDiscountPct(martCart.length)/100));
  if (coins < total) { showMessage('Not enough credits', 'var(--red)'); return; }
  coins -= total; updateCoinsUI();
  martCart.forEach(key => { const [cat,i]=key.split('-'); const p=martStock[cat][+i];
    if (!p._sold && typeof p.buy==='function') { try { p.buy(); } catch(e){ console.error('[MART] buy failed', e); } p._sold=true; } });
  try { sfxRewardGood && sfxRewardGood(); } catch(e){}
  showMessage(`Bought ${martCart.length} — 💰${total}`, 'var(--gold)');
  martCart = [];
  renderMart();
}
function martReroll() {
  const maxR = limits.reroll ? limits.reroll.current : 3;
  if (martRerollN >= maxR) { showMessage('No rerolls left', 'var(--red)'); return; }
  const cost = 8 + martRerollN*2;
  if (coins < cost) { showMessage('Not enough credits', 'var(--red)'); return; }
  coins -= cost; updateCoinsUI(); martRerollN++;
  const sold = {}; Object.keys(martStock).forEach(cat => martStock[cat].forEach((p,i)=>{ if(p._sold) sold[`${cat}-${i}`]=p; }));
  buildMartStock();
  Object.keys(sold).forEach(key => { const [cat,i]=key.split('-'); if (martStock[cat]) martStock[cat][+i]=sold[key]; });
  martCart = martCart.filter(k => { const [cat,i]=k.split('-'); return martStock[cat] && martStock[cat][+i] && !martStock[cat][+i]._sold; });
  renderMart();
}

// ── slow, slight float on every shop item (matches the reward-grid float to come) ──
function startMartFloat() {
  stopMartFloat();
  const P = { dx:3, dy:4, rot:1.2, per:7, sc:0.5 };
  const seed = () => ({ px:Math.random()*6.283, py:Math.random()*6.283, pr:Math.random()*6.283, fx:0.85+Math.random()*0.35, fy:0.75+Math.random()*0.45, fr:0.7+Math.random()*0.5 });
  function loop(ms) {
    const s = ms/1000, w = 2*Math.PI/P.per;
    document.querySelectorAll('#mart-overlay .m-item').forEach(el => {
      if (el.classList.contains('frozen') || el.classList.contains('sold')) return;
      if (!el._seed) el._seed = seed();
      const k = el._seed;
      const x = P.dx*Math.sin(s*w*k.fx+k.px), y = P.dy*Math.sin(s*w*k.fy+k.py), r = P.rot*Math.sin(s*w*k.fr+k.pr);
      el.style.transform = `translate(${x.toFixed(2)}px,${y.toFixed(2)}px) rotate(${r.toFixed(2)}deg)`;
    });
    _martFloatRAF = requestAnimationFrame(loop);
  }
  _martFloatRAF = requestAnimationFrame(loop);
}
function stopMartFloat() { if (_martFloatRAF) cancelAnimationFrame(_martFloatRAF); _martFloatRAF = null; }
