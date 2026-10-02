# Notices

Every line the game can put at the top of the screen, and whether it prints.

**The rule.** A notice prints when it tells the player something they could not
already see: a move was refused and why, something happened TO them (a boss, a
curse, a random roll, a penalty firing), a hidden effect is now armed for a later
hand, or a hidden number changed. It goes through `noteMessage` (prints nothing,
kept in `noticeLog`) when it only repeats what the player just chose or what the
HUD already shows: a pick, a purchase, a sale, a chosen reward's text, a resource
counter that visibly moved.

New notices: `showMessage` / `refuse` to print, `noteMessage` to stay quiet.
The dev panel's own messages always print.

## Printed (212)
| where | text |
|---|---|
| boss-effects.js:207 |  Objective ${before.toLocaleString()} → ${roundGoal.toLocaleString()} |
| boss-effects.js:218 |  −${fee} credits |
| boss-effects.js:239 |  ${kind === 'swap' ? 'Swap' : 'Discard'} costs ${fee} credits - you have ${coins} |
| boss-effects.js:273 |  ${bossRedactedFamily.toUpperCase()} hands score a quarter |
| boss-effects.js:389 |  A cell goes dark |
| boss-effects.js:403 |  Cells contaminated |
| boss-effects.js:413 |  ${trickIdToName(id)} suspended |
| boss-effects.js:439 |  ${card.rank}${cardColorSuit(card)} on hold ${Math.round(total)}s |
| boss-effects.js:492 |  ${draw.join( |
| boss-effects.js:501 |  −1 discard |
| boss-effects.js:502 |  −1 swap |
| boss-effects.js:552 |  marked.length > 1 ? `${marked.length} marked cards - discarded` : 'Marked card - discarded |
| boss-effects.js:658 |  QUOTA ${Math.round(m.share * 100)}% MET |
| boss-effects.js:661 |  QUOTA MISSED - score reset |
| boss-effects.js:726 |  NO ${bossInspectHand.toUpperCase()} - ${lost} score |
| boss-effects.js:741 |  QUOTA RAISED - ${roundGoal.toLocaleString()} |
| boss-effects.js:769 |  ${[...clean].join('  |
| boss-effects.js:788 |  ${where} OF THE BOARD PAYS MOST |
| boss-effects.js:928 |  🪶 taken: ${labels} |
| boss-effects.js:961 |  −${lost} Focus |
| boss.js:354 |  The Hollow claims a card |
| card-states.js:442 |  ♛ Royal Favour - a Queen leaves the board |
| card-states.js:468 |  n.text |
| card-states.js:491 |  ♻ Turnover - a stale card is replaced |
| card-states.js:575 |  ${def.icon} ${out.note} |
| card-states.js:723 |  \u2637 Roll Call - ${pull.length} more ${rank}${pull.length === 1 ? '' : 's'} join the han |
| challenge.js:82 |  CHALLENGE! |
| challenge.js:102 |  CHALLENGE: ${challengeCard.handsAdjacentScored}/${reqParam} |
| challenge.js:137 |  –10s FUTURE ROUNDS |
| challenge.js:142 |  LOST: ${lost.name.toUpperCase()} |
| challenge.js:143 |  NO TRICK TO LOSE |
| challenge.js:145 |  ALL COINS LOST |
| challenge.js:146 |  SCORE –10% |
| combos-aim.js:32 |  ⚡ COMBO ONLINE - ${fam.name}! |
| combos-aim.js:39 |  Combo close: ${fam.name} - need ${entityDisplayName(miss)} |
| combos-aim.js:374 |  Suspended: ${pick.name} (half the round) |
| crunch-mode.js:93 |  ${label} · -${formatTime(paid)} |
| crunch-mode.js:121 |  New quarter · ${formatTime(roundSeconds)} on the clock |
| crunch-mode.js:250 |  Round written off |
| dealers-choice.js:69 | refuse You are already holding cards |
| dealers-choice.js:79 |  🃏 Dealer's Choice - tap a card to swap one in, or DISCARD it |
| dealers-choice.js:284 | refuse That card cannot be replaced |
| dev-panel.js:564 |  All records opened |
| dev-panel.js:569 |  Archive cleared |
| dev-panel.js:715 |  say |
| dev-panel.js:1286 |  Tap a card to make it ${cardStateDef(id).name} |
| dev-panel.js:1296 |  ${d.icon} ${card.rank}${card.suit} is ${d.name} |
| dev-panel.js:1305 |  No board to charge |
| dev-panel.js:1310 |  ${cardStateDef(id).icon} ${card.rank}${card.suit} is ${cardStateDef(id).name} |
| dev-panel.js:1318 |  No ordinary card on the board |
| dev-panel.js:1322 |  Temp ${card.rank}${card.suit} on the board |
| dev-panel.js:1328 |  Card states cleared |
| dev-panel.js:1369 |  No ${type} to improve |
| dev-panel.js:1371 |  \u2191 ${pick.name} improved |
| discard.js:11 | refuse Select a row label first |
| discard.js:31 | refuse No discards left |
| discard.js:164 |  Martyr: +1 charge to ${_restored} Sleight${_restored > 1 ? 's' : ''} |
| discard.js:246 |  ⏪ MISSED |
| discard.js:297 |  🔔 Quarter Chime - next hand +${BAL.quarter_chime.pips} pips |
| discard.js:308 |  🕐 Second Hand - next hand +${BAL.second_hand.mult} mult |
| discard.js:309 |  🕐 Second Hand - next hand +${BAL.second_hand.pips} pips |
| discard.js:315 |  🕐 Minute Hand - next hand x${BAL.minute_hand.mult_mult} mult |
| discard.js:332 |  ⏳ Hourglass - ${card.rank}${card.suit} gains a retrigger |
| discard.js:355 |  ⏸ MISSED |
| discard.js:416 |  ⏱️ Stopwatch - clock frozen |
| events-core.js:116 |  Core Memories! +2 Focus limit |
| events-upgrade.js:145 |  Nothing to reassign into |
| events-upgrade.js:156 |  ${t.name} → ${got.name} |
| events-upgrade.js:238 |  ${winner.name} improved · tier ${t} |
| events.js:227 |  −1 Discard |
| events.js:228 |  −8s |
| events.js:229 |  Empty door |
| events.js:287 |  You won the gamble! |
| events.js:291 |  Lost the gamble! |
| events.js:296 |  Lost ${eventState.stakedTrick.name} |
| events.js:518 |  Those cards have left the run |
| events.js:690 |  won ? `HEADS · ${msg}` : `TAILS · ${msg}` |
| events.js:1096 |  The catch: −5s |
| events.js:1097 |  The catch: −1 discard |
| events.js:1098 |  The catch: −1 swap |
| events.js:1099 |  The catch: goal +15% |
| flow-mode.js:117 |  ⚠ BOSS |
| flow-rewards.js:1012 |  ${boss ? flowrBossPassedText() : 'GOAL CLEARED'} · ×${n} REWARDS |
| flow-rewards.js:1840 | refuse Pick an ordinary card |
| flow-rewards.js:1889 | refuse That would split the group |
| flow-rewards.js:1892 | refuse Up to ${flowrSelMax(op)} cards |
| flow-rewards.js:1895 | refuse Pick a card touching the ones you have |
| flow-rewards.js:1919 | refuse Pick at least 2 touching cards |
| flow-rewards.js:1999 | refuse No ordinary card next to that one |
| focus.js:301 |  🌌 Expanse - Focus limit +${_ex} |
| focus.js:313 |  🎚️ Release Valve - +1 swap, +1 discard, -${BAL.release_valve.focus_drop} Focus |
| focus.js:322 |  🌱 Growth Spurt - max Focus −${BAL.growth_spurt.cap_reduction} |
| grid-pick.js:117 | refuse Not enough credits |
| guided-mode.js:531 |  Challenge met · +${ch.credits} credits |
| guided-mode.js:533 |  Challenge missed |
| hallmark.js:110 |  🔖 Hallmark - a card is marked |
| hallmark.js:173 |  🔖 Hallmark · ${note} |
| input.js:127 | refuse No swaps left |
| input.js:154 | refuse Those cards are not next to each other |
| input.js:183 |  🔃 Pivot - both cards +${BAL.pivot.mult} mult |
| input.js:348 |  Magnet cancelled |
| input.js:352 |  Tap a normal card to pull its rank |
| input.js:356 |  _moved ? `🧲 Magnet pulled ${_moved} ${_t.rank}${_moved > 1 ? 's' : ''} in` : `🧲 No ${_t.ra |
| input.js:396 |  ⏱️ Stopwatch - stopped |
| input.js:398 | refuse Stopwatch is spent |
| input.js:404 | refuse ${jdef.name} already used this round |
| input.js:410 | refuse Capacitor needs ${BAL.capacitor.focus_cost} Focus |
| input.js:426 | refuse Siphon needs ${BAL.siphon.focus_cost} Focus |
| input.js:429 |  🩸 Siphon - next hand ×${BAL.siphon.mult} mult! |
| input.js:438 |  Magnet armed - tap a card to pull its rank |
| input.js:654 | refuse Select exactly 2 cards to swap them |
| insights.js:360 |  Tips off. Settings > Help to turn them back on. |
| insights.js:455 |  Tips reset - each one will show once more. |
| interlude.js:252 |  Payout withheld |
| interlude.js:253 |  Interest frozen (${interestFreezeRounds} more) |
| level-types.js:112 |  Goal ${q.idx} of ${q.bars.length} cleared |
| level-types.js:123 |  ${l.axis === 'row' ? 'Row' : 'Column'} ${l.index + 1} filled |
| level-types.js:138 |  ${m.icon} ${m.name}: ${m.desc} |
| level-up.js:68 |  Short staffed: one ${nextRoundGridShrink === 'rows' ? 'row' : 'column'} down |
| level-up.js:245 |  Coin Toss: ${_refilled} Sleight${_refilled > 1 ? 's' : ''} regained a charge |
| level-up.js:283 |  🥁 Metronome: ' + metronomeHandType, '#5aa9e6 |
| limit-break.js:263 |  Pick what you are giving up |
| limits.js:306 |  ${label // 'Limit up'} - all limits maxed! |
| limits.js:311 |  ${label // 'Limit up'} - ${pick.label} +${step} |
| map-mode.js:953 | refuse Not enough time on the clock |
| map-mode.js:960 |  It was: ${mapTileFace(t).name} |
| map-mode.js:977 |  Left the slot early · +${pay} credits |
| match3.js:81 |  At least one match type must stay on |
| payout-pick.js:316 |  That did not take |
| play-hand.js:126 |  the little guys! +' + _lgf + ' Focus limit |
| play-hand.js:134 |  Quick Draw! +' + _qd + ' Focus limit |
| play-hand.js:432 |  Spot check cleared |
| play-hand.js:433 |  Spot check: ${spotCheckLeft} more |
| play-hand.js:644 |  💎 Blood Diamonds - +${_bdCoins} credits, -${_bdSecs}s |
| play-hand.js:673 |  OUT OF CREDITS |
| play-hand.js:677 |  -${_fee} credits |
| play-hand.js:772 |  Temporal Rift! +' + BAL.temporal_rift.rewind + 's rewind when scored |
| play-hand.js:794 |  Curse lifted: ${card.rank}${card.suit} |
| play-hand.js:799 |  Scavenger: +${BAL.scavenger.coins} coins, +1 discard next round |
| play-hand.js:807 |  Bedrock! +' + BAL.rare_bloom.perm_pips + ' pips to those cards |
| play-hand.js:977 |  Ley Line! +' + (BAL.rowcol_perm_double.perm_mult * _ln) + ' mult |
| progress-unlock.js:148 |  Each mode will walk you through it again. |
| reward-grid.js:205 |  Spot check: ${_h} ×${BAL.spot_check.mult} |
| reward-grid.js:219 |  A cell went dead |
| reward-grid.js:232 |  Rider on ${_t.name} |
| reward-grid.js:247 |  ${v.rank}${v.suit} cursed: ${CURSE_DEFS[_cid].name} |
| reward-grid.js:393 |  ${pick.name} could not be improved |
| reward-grid.js:501 |  ${rank}${suit} was already gone |
| reward-grid.js:585 |  _cl ? `Curse lifted: ${_cl.face}` : 'No curses to lift' |
| reward-grid.js:843 |  Mystery: +12 coins! |
| reward-grid.js:845 |  Mystery: +2 swaps next round! |
| reward-grid.js:847 |  Mystery: +2 discards next round! |
| reward-grid.js:849 |  Mystery: +25s next round! |
| reward-grid.js:854 |  Mystery: ${rank}${suit} +10 pips! |
| reward-grid.js:858 |  Mystery: -8 coins… |
| reward-grid.js:860 |  Mystery: -1 swap next round… |
| reward-grid.js:862 |  Mystery: -15s next round… |
| reward-grid.js:864 |  Mystery: a Stone slips into your deck… |
| reward-grid.js:866 |  v ? `Mystery: ${v.rank}${v.suit} cursed (${CURSE_DEFS[v.curse].name})…` : 'Mystery: …nothi |
| reward-grid.js:915 |  No Tricks to lose |
| reward-grid.js:988 |  - ${opt.trick.name} |
| reward-grid.js:994 |  - ${opt.trick.name} |
| reward-grid.js:1009 |  +10 PIPS |
| reward-grid.js:1012 |  + KNACK |
| reward-grid.js:1019 |  + ${pick.name} |
| reward-grid.js:1765 | refuse Take ${rewardMinPicks() - rewardSelected.size} more to confirm |
| reward-grid.js:1789 |  More Better! +${BAL.more_better.mult} mult (now +${bonusMult_morebetter}) |
| reward-grid.js:1796 |  Shady Stimulants - +${_negThisGrid} Focus limit |
| round-timers.js:137 |  🎭 Understudy - ${_t.name} primed |
| round-timers.js:181 |  currentBoss?.modifiers?.includes('trick_pool_split') |
| round-timers.js:350 |  SECOND CHANCE - FINISH THE CHALLENGE! |
| round-timers.js:379 |  SECOND CHANCE |
| round-timers.js:387 |  🪢 Safety Net - 30s extension! |
| round-timers.js:442 |  text |
| score-dance.js:1305 |  GOAL MET - COMPLETE THE CHALLENGE |
| scoring.js:1578 |  🤝 Buddy System - ' + buddy.name + ' primed |
| shop-grid-preview.js:1018 | refuse Not enough credits |
| shop-grid-preview.js:1097 | refuse shopGridSel.size ? 'Select just one tile or row label to swap' : 'Select a tile or row lab |
| shop-grid-preview.js:1106 | refuse Nothing to lift |
| shop-grid-preview.js:1107 | refuse No swaps left |
| shop-grid-preview.js:1138 | refuse Trade with a tile it touches |
| shop-grid-preview.js:1140 | refuse No swaps left |
| shop-grid-preview.js:1142 | refuse A row label only trades with another row label |
| shop-grid-preview.js:1157 | refuse Those two are different widths |
| shop-grid-preview.js:1186 | refuse rows.length > 1 ? `Needs ${rows.length} discards` : 'No discards left'); |
| sleights-runtime.js:120 | refuse ${def.name} is spent |
| sleights-runtime.js:163 |  ${def?.name // 'Sleight'} discards itself |
| sleights-runtime.js:330 |  🔪 Whetstone +${fed} mult |
| sleights-runtime.js:417 |  🔧 Jury-Rig - ${sleightDef(card)?.name // 'Sleight'} +${_got} charge${_got > 1 ? 's' : ''} |
| sleights-runtime.js:498 |  🌿 Naturalist - ${buffed} card${buffed>1?'s':''} +2 pips! |
| sleights-runtime.js:520 |  ⚡ Lightning Rod - +5 pips! |
| sleights-runtime.js:528 |  🧪 Catalyst - +1 perm mult! |
| sleights-runtime.js:639 |  ${id} is suspended this round |
| sleights-runtime.js:661 |  Shortcut - challenge complete! |
| sleights-runtime.js:662 |  Shortcut - no active challenge |
| sleights-runtime.js:681 |  🔁 Echo - next hand scores twice! |
| sleights-runtime.js:698 |  💣 Bomb - ${_cnt} cards +3 pips! |
| sleights-runtime.js:702 |  📜 Legacy - next hand ×3! |
| sleights-runtime.js:708 |  📢 Amplifier - next hand +5 mult! |
| sleights-runtime.js:724 |  ⏬ Sandbagger - needs a pair |
| sleights-runtime.js:1010 |  The Ringer - ${added.rank}${added.suit // ''} joins the hand |
| spectrum.js:76 |  Deck rebuilt - ${ACTIVE_RANKS.length} values × ${ACTIVE_SUITS.length} colours = ${expected |
| spectrum.js:230 |  Deck would be too small (min ${spectrumMinDeck()} cards) |
| spectrum.js:249 |  Spectrum mode only |
| survival.js:212 |  ⚠ BOSS INCOMING |
| survival.js:540 |  Rain Check · +${s}s next round |
| survival.js:853 |  BOSS ${survivalBossesBeaten}/${SURVIVAL_BOSS_COUNT} DEFEATED · +${PICK_REROLLS_PER_BOSS} R |
| survival.js:906 |  ↯ ENDLESS - quotas accelerated |
| survival.js:918 |  Entry fee is ${SURVIVAL_SHOP_COST} 💰 |
| tricks-ui.js:116 | refuse Trick slots full (${trickTray.length}/${trickCapacity()}). Sell one first. |
| tricks-ui.js:305 |  🍀 Feelin Lucky rerolled: ${t._luckyRanks.join('  |
| tricks-ui.js:418 |  dragDiscardArmed ? 'Drag to discard' : 'Discard cancelled' |

## Quiet (116)
| where | text |
|---|---|
| combos-aim.js:141 |  🪞 Reflect leaves the board |
| discard.js:122 |  Five for Fodder! +' + BAL.five_fodder.credits + ' credits |
| discard.js:148 |  Down and Back In: +1 swap, +${BAL.down_and_back_in.coins} coins |
| discard.js:149 |  Down and Back In: +1 discard, +${BAL.down_and_back_in.coins} coins |
| discard.js:278 |  label |
| events-slots.js:292 |  ${eventState.floorWon} cards improved |
| events-slots.js:407 |  +${BAL.the_payline.consolation_credits} credits |
| events-slots.js:409 |  ${eventState.paylineWon.length} improved |
| events-upgrade.js:139 |  +${BAL.reassignment.consolation_credits} credits |
| events-upgrade.js:221 |  +${BAL.the_draw.consolation_credits} credits |
| events.js:90 |  + ${item.name} |
| events.js:119 |  Sacrificed knack · 2 Tricks gained |
| events.js:134 |  + ${pick.name} · −1 Discard |
| events.js:152 |  Sleight upgraded! |
| events.js:165 |  −10s · +1 Swap · +1 Discard |
| events.js:216 |  + ${p.name} |
| events.js:519 |  ${buffJoin(hit)}: ${buffOfferName(opt.e)} |
| events.js:571 |  ${cardLabel(t)} \u00d72 pips |
| events.js:576 |  Copied ${cardLabel(t)} \u00b7 +20 pips |
| events.js:587 |  ${cardLabel(t)} replay + \u00d72 mult |
| events.js:597 |  +2 swaps \u00b7 ${cardLabel(t)} +40 pips |
| events.js:603 |  ${cardLabel(t)} +15 pips |
| events.js:740 |  + ${item.name} |
| events.js:754 |  +3 mult for 3 rounds |
| events.js:760 |  +20s for 2 rounds |
| events.js:770 |  Gave up ${lost.name} · goal halved for 4 rounds |
| events.js:985 |  ${cut} card${cut > 1 ? 's' : ''} cut from the deck |
| events.js:994 |  Limits restored - ${limits.swaps.base} swaps, ${limits.discards.base} discards |
| events.js:998 |  +1 swap, +1 discard per round |
| events.js:1011 |  +1 discard restored |
| events.js:1079 |  Overtime · +${formatTime(OVERTIME_SECONDS)} · ${notes.join(' ·  |
| events.js:1259 |  +${eventState.shiftPayout} credits |
| events.js:1271 |  Shift change - Trick order updated |
| events.js:1364 |  ${cardLabel(t)}: ${buffOfferName(b.e)} |
| events.js:1405 |  +${BAL.rehearsal.consolation_credits} credits |
| events.js:1409 |  ${t.name} rehearsed - fires ${t._rank + 1}× a hand |
| events.js:1488 |  +${BAL.workshop.consolation_credits} credits |
| events.js:1495 |  n ? `${n} Sleight${n > 1 ? 's' : ''} refilled` : 'All Sleights already full' |
| events.js:1505 |  ${def.name} reinforced - ${sleightMaxCharges(def)} charges |
| events.js:1616 |  ${basket.length} card${basket.length > 1 ? 's' : ''} added to your deck |
| events.js:1717 |  ${cut} card${cut === 1 ? '' : 's'} cut from the deck |
| events.js:1802 |  +${BAL.clean_slate.consolation_credits} credits |
| events.js:1812 |  say // 'Cleared' |
| flow-rewards.js:1436 |  ⬆ ${opt.name} improved to v${tier}.0 |
| flow-rewards.js:1939 |  ${op.icon} ${op.name} on ${hits} card${hits === 1 ? '' : 's'} |
| flow-rewards.js:2035 |  ${op.icon} ${op.name}: ${count} card${count === 1 ? '' : 's'} |
| flow-rewards.js:2059 |  ${op.icon} ${label} on ${q} card${q === 1 ? '' : 's'} |
| flow-rewards.js:2259 |  🃏 ${made} card${made === 1 ? '' : 's'} joined the deck · ${pack.label} |
| focus.js:307 |  🏦 Dividend - +${BAL.dividend.credits} credits |
| guided-mode.js:601 |  + ${d.name} |
| interlude.js:106 |  ⛵ Trade Winds - +${_payout} credits |
| interlude.js:212 |  🗿 Idol - triple interest! |
| limit-break.js:185 |  say |
| limit-break.js:272 |  say |
| limit-break.js:281 |  ✖ ${lost.name} |
| limit-break.js:285 |  ✖ ${lost.name} |
| limit-break.js:297 |  secondSay |
| map-mode.js:1125 |  + ${k.name} |
| payout-pick.js:321 |  ${face} · ${note} |
| play-hand.js:146 |  Double Dutch! +' + _ddf + ' Focus |
| play-hand.js:188 |  Clean Sweep! +${BAL.clean_sweep.focus * _csf} Focus, +${BAL.clean_sweep.credits * _csf} cr |
| play-hand.js:505 |  🎯 LUCKY SEVEN - +1 SWAP |
| play-hand.js:688 |  📋 Type A - +1 discard |
| play-hand.js:715 |  🧳 Traveler - +1 swap |
| play-hand.js:752 |  Undue Influence +' + _ui + ' credits |
| reward-grid.js:106 |  Round cap -5s (permanent) |
| reward-grid.js:109 |  -1 discard next round |
| reward-grid.js:112 |  -1 swap next round |
| reward-grid.js:118 |  Playing a hand costs +2s (permanent) |
| reward-grid.js:121 |  Hands cost +5s next round |
| reward-grid.js:124 |  Discarding costs +2s/card (permanent) |
| reward-grid.js:127 |  Discards cost +5s/card next round |
| reward-grid.js:131 |  -10 coins |
| reward-grid.js:134 |  2 Stones added to deck |
| reward-grid.js:137 |  -20s next round |
| reward-grid.js:144 |  Goals +10% (permanent) |
| reward-grid.js:147 |  Focus gain reduced (permanent) |
| reward-grid.js:150 |  Next payout withheld |
| reward-grid.js:158 |  A ${noun} will be suspended next round |
| reward-grid.js:165 |  -${n} Luck |
| reward-grid.js:169 |  Interest frozen for ${BAL.interest_freeze.rounds} rounds |
| reward-grid.js:189 |  -1 ${_noun} next round |
| reward-grid.js:262 |  ${_dtx} ${_dl.label} |
| reward-grid.js:396 |  \u2191 ${pick.name} improved |
| reward-grid.js:437 |  + ${pick.name} |
| reward-grid.js:458 |  ${face}: ${buffOfferName(e)} |
| reward-grid.js:477 |  ${op.icon} ${op.name}: pick your cards when the board deals |
| reward-grid.js:489 |  ${op.icon} ${lbl} on ${picks.length} card${picks.length === 1 ? '' : 's'} |
| reward-grid.js:500 |  ${rank}${suit} culled from deck |
| reward-grid.js:532 |  ${_tx} ${dl.label}! |
| reward-grid.js:555 |  +1 discard next round |
| reward-grid.js:558 |  +1 swap next round |
| reward-grid.js:561 |  +15s next round |
| reward-grid.js:564 |  +8 coins |
| reward-grid.js:576 |  +${n} Luck |
| reward-grid.js:610 |  +${gain}${u} ${def.label}! |
| reward-grid.js:1233 |  _msg |
| round-timers.js:113 |  ⏲️ Tempo - +1 swap |
| round-timers.js:114 |  ⏲️ Tempo - +1 discard |
| scoring.js:1980 |  ${trick.name} → ${axis === 'row' ? 'row' : 'column'} ${i + 1} |
| shop-grid-preview.js:328 |  ⬆ ${t.name} improved |
| shop-grid-preview.js:1032 |  Bought ${bought.length} - 💰${total} |
| shop-grid-preview.js:1067 |  Sold ${p.label} - +💰${p.price} |
| shop-grid-preview.js:1194 |  rows.length > 1 ? `Rerolled ${rows.length} rows` : 'Row rerolled' |
| shop.js:30 |  Sold ${trick.name} · +${v} credits |
| shop.js:42 |  Sold ${knack.name} · +${v} credits |
| sleights-runtime.js:86 |  + ${def.name} |
| sleights-runtime.js:179 |  ${sleightDef(card)?.name // 'Sleight'} consumed |
| sleights-runtime.js:194 |  ${sleightDef(card)?.name // 'Sleight'} consumed - locked until discarded or played |
| sleights-runtime.js:731 |  ${SLEIGHT_POOL.find(j=>j.id===id)?.name//'Sleight'} activated! |
| sleights-runtime.js:752 |  😵 Fresh Start - the board is redealt |
| spectrum.js:148 |  ${def.emoji} ${def.name} - ${bits.join( |
| survival.js:195 |  +${gained} 💰 |
| survival.js:602 |  ${opt.icon} ${opt.name}! |
| survival.js:603 |  ${opt.icon} ${opt.name}! |
| survival.js:605 |  _say |
