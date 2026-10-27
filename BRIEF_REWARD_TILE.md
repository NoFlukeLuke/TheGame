# Brief: the REWARD tile becomes the priority account's payout

For the "Gameplay flights and challenge rewards" session. Owner's call, r669 chat.

**Built in r689, CHANGED by the owner** (CLAUDE.md r689 is what ships; the text below is the
brief as written): a priority account pays the payout and the reward grid with NO pick of three;
an audit pays its cards and nothing else (no pick of three either); the REWARD tile stays, as
IT's tile alone (at least 1, at most 2 a map); priority accounts are a little more common
(`MAP_AUDIT_SHARE` 0.4); the first-five-grids ramp is unchanged; mystery tiles roll their kind
(`MAP_MYSTERY_W`), a reward grid among them in any quarter.

## The problem

The Schedule's REWARD tile is the only place in the game where a reward grid is somewhere you
walk to. Everywhere else a grid follows a round you cleared. A free grid on the to-do list reads
as odd, and the audit no longer needs one (r669 dropped its prize grid, r671 gave each card a
named department reward).

## The change

- **The PRIORITY account pays a reward grid.** A cleared hard round goes: payout, pick of three,
  the reward grid (ordinary size and table, `rewardGridContext 'interlude'`), the schedule. The
  knack pick (`mapKnackPickTwo`, +20 Luck) goes; the department's challenge rewards and the
  grid are the hard round's payoff. The tile's stake line reads the goal and "PATH OF n".
- **The REWARD tile is removed from the map.** `MAP_MINIMUMS` loses `['reward', 1]`; the kind
  stays in `MAP_KIND_META` for saved maps, which draw it until the quarter rolls over.
- **The audit is untouched.** It pays its cards' department rewards and the pick of three.

## What leans on the REWARD tile today

- **IT's department tile** (`js/departments.js`, `tile: 'reward'`). Point it at `priority`
  instead: IT leans toward hard rounds, and its Standard reward (+1 to the next grid's path)
  still has a grid to land on.
- **The first-five-grids ramp** (`rewardGridsSeen` gates the guaranteed row / column / selection
  / stock tiles). With one grid per hard round a Schedule run sees fewer grids and later. Either
  count hard rounds toward the ramp as before, or move the ramp's guarantees onto the prize grid.
  Decide before building; the ramp is where early runs get their board size.
- **Trick Slot room** (`rewardTrickRoom`) and the Limit Break tile are per grid and need nothing.
- The handbook's Schedule lines, the ? card's legend and `MAP_HELP_PICK` name the REWARD tile.
- The sim's tile list (`tools/sim/runner.js`) knows the kind; rerun the 8-tile walk after.

## Not in scope

The post-review PRIZE grid stays. Classic's reward grid after every round stays. Flow is untouched.
