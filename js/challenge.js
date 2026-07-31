const CHALLENGE_REQS = ['hand_type', 'score_threshold', 'adjacent_plays'];

let challengeTooltipTimer = null;
let challengeTooltipVisible = false;

function showChallengeTooltip(anchorEl) {
  if (!challengeCard) return;
  const tt = document.getElementById('challenge-tooltip');
  const body = document.getElementById('ctt-body');
  const prog = challengeCard.req === 'adjacent_plays'
    ? ` (${challengeCard.handsAdjacentScored}/${challengeCard.reqParam} done)` : '';
  body.textContent = challengeCard.reqDesc + prog;
  const rect = anchorEl.getBoundingClientRect();
  tt.style.left = Math.min(rect.left, window.innerWidth - 260) + 'px';
  tt.style.top  = (rect.bottom + 6) + 'px';
  tt.classList.add('show');
  challengeTooltipVisible = true;
  clearTimeout(challengeTooltipTimer);
}

function toggleChallengeTooltip(anchorEl) {
  const tt = document.getElementById('challenge-tooltip');
  if (challengeTooltipVisible) {
    hideChallengeTooltip();
    return;
  }
  if (!challengeCard) return;
  const body = document.getElementById('ctt-body');
  const prog = challengeCard.req === 'adjacent_plays'
    ? ` (${challengeCard.handsAdjacentScored}/${challengeCard.reqParam} done)` : '';
  body.textContent = challengeCard.reqDesc + prog;
  const rect = anchorEl.getBoundingClientRect();
  tt.style.left = Math.min(rect.left, window.innerWidth - 260) + 'px';
  tt.style.top  = (rect.bottom + 6) + 'px';
  tt.classList.add('show');
  challengeTooltipVisible = true;
  clearTimeout(challengeTooltipTimer);
  // Auto-hide after 6s
  challengeTooltipTimer = setTimeout(hideChallengeTooltip, 6000);
}

function hideChallengeTooltip() {
  document.getElementById('challenge-tooltip').classList.remove('show');
  challengeTooltipVisible = false;
  clearTimeout(challengeTooltipTimer);
}

function spawnChallengeCard() {
  const cols = [0,1,2,3,4];
  shuffle(cols);
  const col = cols[0];

  const reqType = CHALLENGE_REQS[Math.floor(Math.random() * CHALLENGE_REQS.length)];
  let reqParam, reqDesc;

  if (reqType === 'hand_type') {
    const handsArr = [...unlockedHands];
    const handKey = handsArr[Math.floor(Math.random() * handsArr.length)];
    reqParam = HAND_KEY_TO_NAME[handKey] || handKey;
    reqDesc = `Score a ${reqParam} before this round ends`;
  } else if (reqType === 'score_threshold') {
    const threshold = Math.round(roundGoal * (0.4 + Math.random() * 0.4) / 100) * 100;
    reqParam = threshold;
    reqDesc = `Score ${threshold.toLocaleString()} in a single hand`;
  } else {
    reqParam = 2;
    reqDesc = `Score ${reqParam} hands with a card adjacent to this card`;
  }

  challengeCard = {
    pos: [0, col],
    req: reqType,
    reqParam,
    reqDesc,
    handsAdjacentScored: 0,
    handTypeScored: false,
    thresholdMet: false,
  };
  challengeActive = true;
  gridData[0][col] = null; // challenge card occupies this cell — render handles display
  render();
  showMessage('CHALLENGE!', '#dd6666');
  sfxChallengeAppear();
}

function checkChallengeAfterHand(handResult, handCells) {
  if (!challengeActive || !challengeCard) return;
  const { req, reqParam, pos } = challengeCard;

  if (req === 'hand_type') {
    if (handResult.hand === reqParam) { resolveChallenge(true); return; }
  } else if (req === 'score_threshold') {
    if (handResult.finalScore >= reqParam) { resolveChallenge(true); return; }
  } else if (req === 'adjacent_plays') {
    const [cr, cc] = pos;
    const adjacent = handCells.some(([r,c]) =>
      (Math.abs(r - cr) <= 1 && c === cc) || (Math.abs(c - cc) <= 1 && r === cr)
    );
    if (adjacent) {
      challengeCard.handsAdjacentScored++;
      if (challengeCard.handsAdjacentScored >= reqParam) { resolveChallenge(true); return; }
      showMessage(`CHALLENGE: ${challengeCard.handsAdjacentScored}/${reqParam}`, '#dd6666');
    }
  }
}

function resolveChallenge(success) {
  if (!challengeActive) return;
  challengeActive = false;
  hideChallengeTooltip();
  challengeTooltipVisible = false;

  // Replace the null cell immediately and clear challengeCard
  // so render() stops treating it as a challenge cell right away
  if (challengeCard) {
    const [r, c] = challengeCard.pos;
    if (gridData[r][c] === null) gridData[r][c] = drawCard() || null;
  }
  challengeCard = null;
  render();

  if (success) {
    sfxChallengeWin();
    showChallengeOverlay(true, 'Choose a trick reward!', () => {
      // Always show challenge trick first
      // If goal was already reached, pendingLevelUps will drain after selectTrick closes
      if (goalReachedThisRound) {
        clearInterval(roundInterval);
        roundInterval = null;
        // Queue one extra level-up for the round goal so it fires after challenge trick
        pendingLevelUps++;
      }
      showChallengeTrick();
    });
  } else {
    const penalties = [
      () => { roundPenaltySeconds += 10; showMessage('–10s FUTURE ROUNDS', '#e74c3c'); },
      () => {
        if (acquiredTricks.length > 0) {
          const lost = acquiredTricks.splice(Math.floor(Math.random() * acquiredTricks.length), 1)[0];
          updateTrickList();
          showMessage(`LOST: ${lost.name.toUpperCase()}`, '#e74c3c');
        } else { showMessage('NO TRICK TO LOSE', '#e74c3c'); }
      },
      () => { coins = 0; updateCoinsUI(); showMessage('ALL COINS LOST', '#e74c3c'); },
      () => { score = Math.round(score * 0.9); updateScoreUI(); showMessage('SCORE –10%', '#e74c3c'); },
    ];
    sfxChallengeFail();
    showChallengeOverlay(false, 'Penalty applied...', () => {
      penalties[Math.floor(Math.random() * penalties.length)]();
      render();
    });
  }
}

function showChallengeOverlay(success, subText, onDone) {
  clearTimeout(challengeOverlayTimer);
  const overlay = document.getElementById('challenge-overlay');
  const title   = document.getElementById('ch-title');
  const sub     = document.getElementById('ch-sub');
  const bar     = document.getElementById('ch-bar');
  title.textContent = success ? 'CHALLENGE COMPLETE' : 'CHALLENGE FAILED';
  title.className   = `ch-title ${success ? 'success' : 'fail'}`;
  sub.textContent   = subText;
  bar.style.transition = '';
  bar.style.width   = '100%';
  bar.style.background = success ? '#dd6666' : '#e74c3c';
  overlay.classList.add('show');
  requestAnimationFrame(() => {
    bar.style.transition = 'width 2s linear';
    bar.style.width = '0%';
  });
  challengeOverlayTimer = setTimeout(() => {
    overlay.classList.remove('show');
    bar.style.transition = '';
    onDone();
  }, 2100);
}

function showChallengeTrick() {
  isChallengeTrickPick = true;
  const overlay = document.getElementById('levelup-overlay');
  document.getElementById('levelup-title').textContent = 'CHALLENGE REWARD';
  document.getElementById('levelup-sub').innerHTML = 'Choose a trick — <span id="lu-timer">15</span>s remaining';
  overlay.classList.add('show');
  const options = pickTrickOptions(3);
  const container = document.getElementById('trick-options');
  container.innerHTML = '';
  options.forEach(b => {
    const div = document.createElement('div');
    div.className = 'trick-option';
    div.innerHTML = `
      <div class="bo-tier ${b.tier}">${b.tier.toUpperCase()}</div>
      <div class="bo-border ${b.tier}"></div>
      <div class="bo-name">${b.name}</div>
      <div class="bo-desc">${withSuitHalo(b.desc)}</div>
    `;
    div.addEventListener('click', () => selectTrick(b));
    container.appendChild(div);
  });
  levelupSeconds = LEVEL_UP_DURATION;
  document.getElementById('lu-timer').textContent = levelupSeconds;
  document.getElementById('levelup-timer-bar').style.width = '100%';
  levelupTimer = setInterval(() => {
    levelupSeconds--;
    document.getElementById('lu-timer').textContent = levelupSeconds;
    document.getElementById('levelup-timer-bar').style.width = (levelupSeconds / LEVEL_UP_DURATION * 100) + '%';
    if (levelupSeconds <= 0) selectTrick(options[0]);
  }, 1000);
}

// SOUND SYSTEM (Web Audio API)
// ══════════════════════════════════════════════
let audioCtx = null;

