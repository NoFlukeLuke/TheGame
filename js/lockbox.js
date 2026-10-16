// ── THE LOCKBOX (r576) - cards you bought, held until you place them ────────
//
// Owner: "the reserve cards can live somewhere that can be accessed with a knack
// or maybe this event grants a sleight that you have to double tap to bring up
// the reserve." The Card Market sells cards into `lockboxStash`; the Lockbox
// Sleight (granted with the first purchase) opens it.
//
// - A STASHED CARD IS NOT IN THE DECK. It is in no pile and on no board, so the
//   deck audit does not count it, and it never cycles. It waits in the box.
// - Double-tap the Lockbox: the stash comes out as Dealer's Choice's held stack
//   (js/dealers-choice.js, mode 'lockbox'). Tap a board card and the top card
//   takes its cell; the old card goes to the back of the draw pile. Free, like
//   the Reserve: no time, no stock, no swap count. A PLACED card has joined the
//   deck for good (expectedDeckTotal goes up), and cycles like any other.
// - DISCARD shows the next card (the top one goes to the bottom), because a card
//   you paid for is not thrown away by a mis-tap.
// - Tap the Lockbox itself, or reach the round's end, to close it: whatever was
//   not placed stays in the box.
// - Buffs on a stashed card are keyed by its cardId like every other card's, and
//   those maps are already saved, so the stash only needs the card objects saved.
let lockboxStash = [];

function lockboxActive() { return typeof dealerActive === 'function' && dealerActive() && dealerHand.mode === 'lockbox'; }
function lockboxDef() { return SLEIGHT_POOL.find(s => s.id === 'lockbox') || null; }
// Grant the Sleight once: a second Lockbox would only open the same box.
function lockboxEnsureOwned() {
  const def = lockboxDef();
  if (!def || (typeof grantedSleightIds !== 'undefined' && grantedSleightIds.has('lockbox'))) return;
  grantSleight(def);
}

function lockboxToggle(jcard, r, c) {
  if (lockboxActive()) { dealerClose(true); return; }
  if (typeof dealerActive === 'function' && dealerActive()) { refuse('You are already holding cards'); return; }
  if (!lockboxStash.length) { refuse('The Lockbox is empty. Buy cards at the Card Market'); return; }
  if (typeof reserveMayOpen === 'function' && !reserveMayOpen()) return;
  selected = []; swapPending = null;
  if (typeof cancelAutoSubmit === 'function') cancelAutoSubmit();
  const src = document.querySelector(`#grid [data-card-id="${jcard._id}"]`)?.getBoundingClientRect();
  const sx = src ? src.left + src.width / 2 : innerWidth / 2, sy = src ? src.top + src.height / 2 : innerHeight / 2;
  const cards = lockboxStash.slice();
  dealerHand = { mode: 'lockbox', box: jcard, cards, els: [], pos: cards.map(() => ({ x: sx, y: sy, vx: 0, vy: 0, rot: 0 })), still: 0, t0: performance.now() };
  dealerBuildLayer();
  if (!lockboxToggle._told) { lockboxToggle._told = true; showMessage('Lockbox: tap a card to put one in its place. DISCARD shows the next. Tap the Lockbox to close it', '#8fd0ff'); }
  dealerStartLoop();
  try { sfxFlipShuffle(); } catch (e) {}
}
// Called by dealerPlaceAt once the card is on the board: it leaves the box and
// joins the deck.
function lockboxPlaced(card) {
  const i = lockboxStash.indexOf(card);
  if (i >= 0) lockboxStash.splice(i, 1);
  expectedDeckTotal++;
  if (typeof updateDeckHud === 'function') updateDeckHud();
}
// DISCARD in the box: the top card goes to the bottom.
function lockboxNext() {
  if (!lockboxActive() || dealerHand.cards.length < 2) { refuse('That is the only card in the box'); return; }
  dealerHand.cards.push(dealerHand.cards.shift());
  dealerHand.pos.push(dealerHand.pos.shift());
  dealerBuildLayer();
  try { sfxCardSelect(); } catch (e) {}
}
