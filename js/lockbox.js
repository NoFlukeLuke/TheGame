// ── BOUGHT CARDS (r576, r590) - cards you bought, held until you place them ──
//
// The Card Market sells cards into `lockboxStash`. r590 (owner: "lockbox isn't a
// thing in the game ... double tap the focus bar to access your reserve cards"):
// while the stash holds cards, a double-tap on the Focus bar opens it, ahead of
// the Reserve and the Focus knacks (focusTapHandler, js/reserve.js); another
// double-tap closes it. No Sleight is granted any more; the Lockbox Sleight stays
// in the data only so a run saved with one still opens the stash.
//
// - A STASHED CARD IS NOT IN THE DECK. It is in no pile and on no board, so the
//   deck audit does not count it, and it never cycles. It waits in the box.
// - Double-tap the Focus bar: the stash comes out as Dealer's Choice's held stack
//   (js/dealers-choice.js, mode 'lockbox'). Tap a board card and the top card
//   takes its cell; the old card goes to the back of the draw pile. Free, like
//   the Reserve: no time, no stock, no swap count. A PLACED card has joined the
//   deck for good (expectedDeckTotal goes up), and cycles like any other.
// - DISCARD shows the next card (the top one goes to the bottom), because a card
//   you paid for is not thrown away by a mis-tap.
// - Double-tap the bar again, or reach the round's end, to close it: whatever
//   was not placed stays in the stash.
// - Buffs on a stashed card are keyed by its cardId like every other card's, and
//   those maps are already saved, so the stash only needs the card objects saved.
let lockboxStash = [];

function lockboxActive() { return typeof dealerActive === 'function' && dealerActive() && dealerHand.mode === 'lockbox'; }
function lockboxDef() { return SLEIGHT_POOL.find(s => s.id === 'lockbox') || null; }

// jcard: the old Lockbox Sleight when a saved run opens it from the board; else
// the stash comes out of the Focus bar.
// r739 (owner): the Lockbox is an offered Sleight again. Double-tap it on the board:
// out come the bought cards, plus BAL.lockbox.temp new temp cards with a random buff
// (made each time, gone when the box closes) and, at its 5th improvement,
// BAL.lockbox.perm new permanent ones (into the stash, kept until placed). Double-tap
// it again, or the Focus bar, to put them away. It discards itself after
// BAL.lockbox.life_seconds on the grid (SLEIGHT_LIFESPAN).
function lockboxExtras(jcard) {
  if (!jcard || typeof BAL === 'undefined' || !BAL.lockbox) return [];
  const roll = () => { const cd = makeTempCard(ACTIVE_RANKS[Math.floor(Math.random() * ACTIVE_RANKS.length)], ACTIVE_SUITS[Math.floor(Math.random() * ACTIVE_SUITS.length)]);
    const e = typeof rollEditorBuff === 'function' ? rollEditorBuff() : null; if (e) enhanceCardKey(cardId(cd), e); return cd; };
  for (let i = 0; i < (BAL.lockbox.perm || 0); i++) { const cd = roll(); delete cd._temp; lockboxStash.push(cd); }
  const out = [];
  for (let i = 0; i < (BAL.lockbox.temp || 0); i++) { const cd = roll(); cd._lockTemp = 1; out.push(cd); }
  return out;
}
function lockboxToggle(jcard) {
  if (lockboxActive()) { dealerClose(true); return; }
  if (typeof dealerActive === 'function' && dealerActive()) { refuse('You are already holding cards'); return; }
  const _extra = lockboxExtras(jcard);
  if (!lockboxStash.length && !_extra.length) { refuse(jcard ? 'The Lockbox is empty. Buy cards at the Card Market' : 'No bought cards. Buy cards at the Card Market'); return; }
  if (typeof reserveMayOpen === 'function' && !reserveMayOpen()) return;
  selected = []; swapPending = null;
  if (typeof cancelAutoSubmit === 'function') cancelAutoSubmit();
  const src = (jcard ? document.querySelector(`#grid [data-card-id="${jcard._id}"]`) : document.getElementById('focus-meter-wrap'))?.getBoundingClientRect();
  const sx = src ? src.left + src.width / 2 : innerWidth / 2, sy = src ? src.top + src.height / 2 : innerHeight / 2;
  const cards = [...lockboxStash.slice(), ..._extra];
  dealerHand = { mode: 'lockbox', box: jcard || null, cards, els: [], pos: cards.map(() => ({ x: sx, y: sy, vx: 0, vy: 0, rot: 0 })), still: 0, t0: performance.now() };
  dealerBuildLayer();
  if (typeof dealerFlyIn === 'function') dealerFlyIn(jcard ? src : reserveSourceRect());
  if (!lockboxToggle._told) { lockboxToggle._told = true; showMessage(`Tap a card to put one in its place. DISCARD or the wheel shows the next. Double-tap ${jcard ? 'the Lockbox' : 'the Focus bar'} to put them away`, '#8fd0ff'); }
  dealerStartLoop();
  try { sfxFlipShuffle(); } catch (e) {}
}
// Called by dealerPlaceAt once the card is on the board: it leaves the box and
// joins the deck.
function lockboxPlaced(card) {
  const i = lockboxStash.indexOf(card);
  if (i >= 0) lockboxStash.splice(i, 1);
  if (card && card._lockTemp) { if (typeof updateDeckHud === 'function') updateDeckHud(); return; }   // r739: a temp card from the box lasts this level
  expectedDeckTotal++;
  if (typeof updateDeckHud === 'function') updateDeckHud();
}
// DISCARD in the box: the top card goes to the bottom.
function lockboxNext() {
  if (!lockboxActive() || dealerHand.cards.length < 2) { refuse('That is your only bought card'); return; }
  dealerHand.cards.push(dealerHand.cards.shift());
  dealerHand.pos.push(dealerHand.pos.shift());
  dealerBuildLayer();
  try { sfxCardSelect(); } catch (e) {}
}
