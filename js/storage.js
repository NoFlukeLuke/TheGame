// ══════════════════════════════════════════════
// STORAGE SHIM  (r155)
// ══════════════════════════════════════════════
// Loads BEFORE every other script. Some browsers do not merely return null from
// localStorage — they THROW on the very first access: Safari private browsing,
// browsers set to block site data, and (the one that matters for us) a
// cross-site sandboxed iframe, which is exactly how itch.io embeds a web game.
//
// That mattered because a dozen files read localStorage at load time, at the top
// level, outside any try/catch — `let devMode = localStorage.getItem(...)` and
// friends. A throw there aborts the REST OF THAT FILE. Measured with storage
// blocked: 8 files died partway through, `bossInterval` / `BOSS_LOOP_DURATION` /
// `devMode` never got defined, the menu still drew fine, and pressing PLAY threw
// — the game looked healthy right up until it wouldn't start.
//
// Rather than wrap ~40 call sites (and rely on every future one remembering),
// this swaps in a same-shaped in-memory stand-in when the real thing is
// unavailable. Settings then last for the session but not beyond it, which is
// the correct degradation: the game runs, it just can't remember. Every existing
// `localStorage.getItem/setItem` call keeps working untouched.
(function () {
  function usable(s) {
    // Presence is not enough — Safari private mode HAS localStorage and throws
    // on write. The probe has to actually write.
    try {
      if (!s) return false;
      const k = '__lethe_probe__';
      s.setItem(k, '1'); s.removeItem(k);
      return true;
    } catch (e) { return false; }
  }

  function memoryStorage() {
    let m = Object.create(null);
    return {
      getItem(k) { const v = m[k]; return v === undefined ? null : v; },
      setItem(k, v) { m[k] = String(v); },
      removeItem(k) { delete m[k]; },
      clear() { m = Object.create(null); },
      key(i) { const ks = Object.keys(m); return i < ks.length ? ks[i] : null; },
      get length() { return Object.keys(m).length; },
    };
  }

  let real = null;
  // Even READING window.localStorage throws in a blocked iframe, so the access
  // itself has to be guarded, not just the calls made on it.
  try { real = window.localStorage; } catch (e) { real = null; }

  if (usable(real)) { window.LETHE_STORAGE_OK = true; return; }

  window.LETHE_STORAGE_OK = false;
  const shim = memoryStorage();
  try {
    Object.defineProperty(window, 'localStorage', {
      value: shim, configurable: true, writable: false,
    });
  } catch (e) {
    // Some engines refuse to redefine it; fall back to a bare global so the
    // unqualified `localStorage.getItem(...)` in the game files still resolves.
    try { window.localStorage = shim; } catch (e2) {}
  }
  console.warn('[LETHE] Browser storage unavailable — settings and saves will not persist this session.');
})();
