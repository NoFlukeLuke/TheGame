# Round-time entities in Flow (r722)

The owner asked what "the round" means in Flow for entities that read the clock, and
for a balance check. Nothing below is changed yet except Time and a Half (r722); each
row ends with a recommendation for the owner.

## What "the round" is in Flow

Flow has one **session clock** between bosses (about 5:00). Level-ups happen inside it,
every 20 to 60 seconds. Two numbers matter:

- `roundSeconds` is the session clock. It drains across levels and is not refilled at a
  level-up.
- `roundStartSeconds` is reset at **every level-up** (`startRoundTimer`,
  js/round-timers.js:74) to whatever the session clock reads then.

So in Flow:

- **"Time since the round started"** means time since **this level** started (short).
- **"Fraction of the round left"** (`roundFractionRemaining()`) means the fraction left
  of what the clock read when this level began. "The last third" needs two thirds of
  that inside one level, which almost never happens.
- **"Seconds left"** reads the whole session clock (up to 5:00, more with rewinds).
- **"Every N seconds"** read off the clock's own reading works as in Classic.
- In a boss, the base is the boss window, like a Classic round.
- In every mode, closing the pause menu restarts `roundStartSeconds` too
  (js/game-control.js:92), so elapsed and fraction effects restart after a pause.

`moneyRoundLeft()` (js/money.js, r722) is the session-aware reading: in Flow outside a
boss it is `roundSeconds / flowSessionSeconds()`, elsewhere `roundFractionRemaining()`.
**Time and a Half uses it**, so in Flow its "last third" is the last third of the session.

## The entities

| Entity | Kind | Reads | In Flow | Recommendation |
|---|---|---|---|---|
| Early Bird | Trick, common | fraction left > 2/3 | On almost the whole session | Read `moneyRoundLeft()` (first third of the session) |
| Night Owl | Trick, common | fraction left <= 1/3 | Almost never fires before the last level | Read `moneyRoundLeft()` |
| Near Extinction | Trick, common | fraction left < 1/3 | Same as Night Owl | Read `moneyRoundLeft()` |
| Time and a Half | Knack, rare | last third / half / two thirds | **Fixed r722**: the session | Done |
| The Swift, Sediment, Erosion | Tricks | seconds since the level began | Small: 20-60s of growth, not 180 | Count from the session's start in Flow, or raise the rate in Flow |
| The Heron | Trick, rare | seconds since the last hand | Same as Classic | None |
| Eagle Eye | Trick, rare | seconds since the last swap | Capped by the level's length | Count across level-ups in Flow |
| The Woodpecker | Trick, rare | every 30s of the level | About the same | None |
| Tick-Tock, Quarter Chime, Second Hand, Hourglass, Minute Hand | Tricks | the clock's own reading | Same rate | Keep charges across a Flow level-up (they are dropped now); Minute Hand's ring is out of step in Flow |
| Sands of Time (and Relativity's half) | Trick, rare | seconds left / divisor | Big early in the session, near 0 before the boss; the divisor already doubles for long clocks | Cap at a Classic round's value |
| Dark Matter | Trick, epic | seconds left | Up to 300+ pips early, near 0 late, no ceiling with rewinds | Cap at 180s worth |
| Cornered, Cornery | Tricks | whole minutes left | x5 early, off in the last minute of every session | Cap at x3 |
| First Wind | Trick, common | first 45s | Banned in Flow already | None |
| Quick Draw, Double Dutch | Tricks | the real clock between hands | About the same | None |
| Understudy | Knack, rare | every 30s of the level | A level under 30s never fires it | Count across level-ups in Flow |
| Stacked | Knack, rare | every 30s of the level | Same as Understudy | Count across level-ups in Flow |
| Tempo | Knack, rare | every 15s of the level | Mildly diluted | Count across level-ups in Flow |
| Hallmark | Knack, rare | a mark time rolled from the last level's base | The mark lands up to ~225s in; most levels never reach it | Roll from the level's own expected length |
| Time Bank | Knack, rare | +30s at a round's start | **Does nothing in Flow**, still offered | Ban in Flow (`FLOW_BANNED_ENTITIES`) |
| Safety Net | Knack, rare | the round ending at 0:00 | **Does nothing in Flow** (0:00 is the boss) | Ban in Flow |
| Clock Tower | Knack, rare | banks leftover time | Banned in Flow already | None |
| Rain Check | Knack, epic | next round's seconds | Flow already rewinds the session instead | None |

Most distorted: Night Owl and Near Extinction (nearly dead), Early Bird (nearly always on),
Hallmark (rarely marks), Time Bank and Safety Net (offered, do nothing), then the
seconds-left Tricks (front-loaded, unbounded with rewinds) and the 30s-counter Knacks.
