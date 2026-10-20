// ═══════════════════════════════════════════════════════════════════════════
// BLANK UI (r474) - the game with every word and number hidden
// ═══════════════════════════════════════════════════════════════════════════
// Owner: "can you make me a preview of the ui but with absolutely no text or
// numbers on it, just an empty ui." Open index.html?blank (or
// empty-ui-preview.html, which wraps it with screen buttons). The layout is the
// real one: text is made transparent rather than removed, so nothing reflows.
// Nothing here runs without ?blank.
(function () {
  if (!/[?&]blank\b/.test(location.search)) return;
  document.body.classList.add('blank-ui');
  // Tips and toasts are words floating over the layout, so they are not drawn.
  try { if (typeof insightsOn === 'function') window.insightsOn = () => false; } catch (e) {}

  function ensureRun() {
    if (typeof gameStartTime !== 'undefined' && gameStartTime && gridData?.length) return false;
    devStartMode('flow');
    setTimeout(() => { try { tutorialEnd(); } catch (e) {} }, 300);
    return true;
  }
  function closeAll() {
    try { if (typeof gridPickState !== 'undefined' && gridPickState) closeGridPick(); } catch (e) {}
    try { if (typeof flowrQueue !== 'undefined' && flowrQueue) { flowrQueue = null; flowrClearStack(); } } catch (e) {}
    try { if (typeof shopGridActive !== 'undefined' && shopGridActive) closeShopGrid(); } catch (e) {}
    try { if (typeof rewardOnGrid !== 'undefined' && rewardOnGrid) closeRewardGrid(); } catch (e) {}
  }
  const GO = {
    menu:   () => location.reload(),
    board:  () => { if (!ensureRun()) { closeAll(); render(); } },
    pick:   () => { const d = ensureRun() ? 4500 : 0; setTimeout(() => { closeAll(); flowrQueue = null; flowrArm(['pick3', 'tricks', 'knacks'], null); }, d); },
    shop:   () => { const d = ensureRun() ? 4500 : 0; setTimeout(() => { closeAll(); triggerShop(); }, d); },
    reward: () => { const d = ensureRun() ? 4500 : 0; setTimeout(() => { closeAll(); openRewardGrid(); }, d); },
  };
  window.addEventListener('message', e => { const f = GO[e.data && e.data.blankGo]; if (f) try { f(); } catch (err) {} });
  const want = (location.search.match(/[?&]screen=(\w+)/) || [])[1];
  if (want && GO[want] && want !== 'menu') setTimeout(() => { try { GO[want](); } catch (e) {} }, 1500);
})();
