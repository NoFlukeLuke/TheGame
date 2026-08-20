// ══════════════════════════════════════════════════════════════════════════
// CHANNEL CHANGE — the CRT transition between screens (play ↔ Mart, rewards…).
//
// Four stacked effects over one clock: static, a vertical roll bar, a collapse
// to a line, and an RGB split, plus an optional channel-number readout. The
// screen being swapped is changed at the collapse, under cover of the flash —
// the way a real set hides the switch.
//
// Tuned in channel-change-preview.html; the presets below are that page's.
// Live sliders + preset picker are in the dev panel under Animation.
// ══════════════════════════════════════════════════════════════════════════

const CC_PRESETS = {
  snap:    { dur:340, static:0.35, roll:0.5, collapse:0.85, split:2, flash:0.45, hold:60 },
  classic: { dur:520, static:0.60, roll:1.0, collapse:1.00, split:4, flash:0.60, hold:90 },
  rough:   { dur:780, static:0.95, roll:1.6, collapse:1.00, split:7, flash:0.55, hold:150 },
  degauss: { dur:620, static:0.15, roll:0.2, collapse:1.00, split:9, flash:1.00, hold:120 },
};
let CC_CFG = { ...CC_PRESETS.classic };
let ccPresetName = 'classic';
let ccEnabled = localStorage.getItem('ccEnabled') !== 'false';
try {
  const saved = JSON.parse(localStorage.getItem('ccCfg') || 'null');
  if (saved && typeof saved === 'object') CC_CFG = { ...CC_PRESETS.classic, ...saved };
  const pn = localStorage.getItem('ccPreset'); if (pn && CC_PRESETS[pn]) ccPresetName = pn;
} catch (e) {}

function saveCcCfg() { try { localStorage.setItem('ccCfg', JSON.stringify(CC_CFG)); } catch (e) {} }
function setCcParam(k, v) { if (k in CC_CFG) { CC_CFG[k] = +v; saveCcCfg(); } }
function setCcPreset(name) {
  if (!CC_PRESETS[name]) return;
  ccPresetName = name; CC_CFG = { ...CC_PRESETS[name] };
  saveCcCfg(); try { localStorage.setItem('ccPreset', name); } catch (e) {}
}
function resetCcCfg() { setCcPreset(ccPresetName); }
function setCcEnabled(on) {
  ccEnabled = !!on;
  try { localStorage.setItem('ccEnabled', ccEnabled ? 'true' : 'false'); } catch (e) {}
}

// ── noise tiles: a few pre-rendered frames, cycled, so the static crawls ──
let _ccNoise = null;
function ccNoise() {
  if (_ccNoise) return _ccNoise;
  _ccNoise = [];
  for (let n = 0; n < 4; n++) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 90;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(90, 90);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = fxRandom() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    _ccNoise.push(`url(${cv.toDataURL()})`);
  }
  return _ccNoise;
}

// The effect layers are full-viewport and sit above every screen (the Mart is a
// body-level overlay at z-index 250), so they are created as a body child.
function ensureCcLayers() {
  let el = document.getElementById('channel-fx');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'channel-fx';
  el.innerHTML = `<div id="cc-static"></div><div id="cc-roll"></div><div id="cc-flash"></div><div id="cc-osd"></div>`;
  document.body.appendChild(el);
  return el;
}

const ccEase      = p => p * p * (3 - 2 * p);
const ccOvershoot = p => { const s = 1.24; return 1 + (--p) * p * ((s + 1) * p + s); };

// Everything that makes up "the picture" — squeezed and split as one.
function ccPictureEls() {
  return ['cabinet', 'mart-overlay', 'shop-overlay', 'event-overlay']
    .map(id => document.getElementById(id))
    .filter(el => el && el.offsetParent !== null);
}

let ccBusy = false;
function channelChangeBusy() { return ccBusy; }

// swapFn runs at the collapse (that's the whole point — it's hidden).
// Returns a promise that resolves when the picture has locked back on.
function channelChange(swapFn, opts = {}) {
  if (!ccEnabled || ccBusy) {
    if (typeof swapFn === 'function') swapFn();
    return Promise.resolve();
  }
  ccBusy = true;
  const fx    = ensureCcLayers();
  const stat  = document.getElementById('cc-static');
  const roll  = document.getElementById('cc-roll');
  const flash = document.getElementById('cc-flash');
  const osd   = document.getElementById('cc-osd');
  const noise = ccNoise();

  const D = CC_CFG.dur, HOLD = CC_CFG.hold, TOTAL = D + HOLD;
  const tearOut = D * 0.42;
  const t0 = performance.now();
  let swapped = false;
  let pics = ccPictureEls();

  fx.classList.add('on');
  if (opts.channel) { osd.textContent = opts.channel; osd.style.opacity = '0'; }
  else osd.textContent = '';

  return new Promise(resolve => {
    function frame(now) {
      const t = now - t0;
      if (t >= TOTAL) { settle(); resolve(); return; }

      const pIn  = Math.min(1, t / tearOut);
      const pOut = t < tearOut + HOLD ? 0 : Math.min(1, (t - tearOut - HOLD) / (D - tearOut));
      const inCollapse = t >= tearOut && t < tearOut + HOLD;

      if (!swapped && t >= tearOut) {
        swapped = true;
        try { if (typeof swapFn === 'function') swapFn(); } catch (e) { console.error('[CC] swap failed', e); }
        pics = ccPictureEls();          // the swap may have shown/hidden a screen
      }

      let sy;
      if (inCollapse)       sy = 1 - CC_CFG.collapse * 0.997;
      else if (t < tearOut) sy = 1 - CC_CFG.collapse * 0.997 * ccEase(pIn);
      else                  sy = (1 - CC_CFG.collapse * 0.997) + (CC_CFG.collapse * 0.997) * ccOvershoot(pOut);
      const sx = 1 + 0.06 * CC_CFG.collapse * (1 - Math.abs(sy));

      const splitAmt = CC_CFG.split * (inCollapse ? 1 : (t < tearOut ? ccEase(pIn) : 1 - ccEase(pOut)));
      const filter = splitAmt > 0.05
        ? `drop-shadow(${splitAmt.toFixed(1)}px 0 rgba(255,0,64,.55)) drop-shadow(${(-splitAmt).toFixed(1)}px 0 rgba(0,190,255,.55))`
        : '';
      pics.forEach(el => {
        el.style.transformOrigin = 'center center';
        el.style.transform = `scale(${sx.toFixed(4)}, ${Math.max(0.003, sy).toFixed(4)})`;
        el.style.filter = filter;
      });

      const sAmt = CC_CFG.static * (inCollapse ? 1 : (t < tearOut ? ccEase(pIn) : 1 - ccEase(pOut)));
      stat.style.opacity = sAmt.toFixed(3);
      stat.style.backgroundImage = noise[Math.floor(t / 45) % noise.length];

      if (CC_CFG.roll > 0.02) {
        const y = ((t / TOTAL) * CC_CFG.roll % 1) * 160 - 30;
        roll.style.opacity = (0.85 * (1 - pOut)).toFixed(3);
        roll.style.top = y.toFixed(1) + '%';
      } else roll.style.opacity = '0';

      flash.style.opacity = (inCollapse ? CC_CFG.flash
        : (t > tearOut ? CC_CFG.flash * (1 - ccEase(pOut)) * 0.5 : 0)).toFixed(3);

      if (opts.channel) osd.style.opacity = (t < tearOut ? 0 : Math.min(1, pOut * 2)).toFixed(2);

      requestAnimationFrame(frame);
    }

    function settle() {
      // Clear every element we touched, including any that got hidden mid-swap.
      ['cabinet', 'mart-overlay', 'shop-overlay', 'event-overlay'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.style.transform = ''; el.style.filter = ''; el.style.transformOrigin = ''; }
      });
      stat.style.opacity = '0'; roll.style.opacity = '0'; flash.style.opacity = '0';
      fx.classList.remove('on');
      ccBusy = false;
      if (opts.channel) {
        setTimeout(() => {
          osd.style.transition = 'opacity .4s'; osd.style.opacity = '0';
          setTimeout(() => { osd.style.transition = ''; }, 420);
        }, 700);
      } else osd.style.opacity = '0';
    }
    requestAnimationFrame(frame);
  });
}
