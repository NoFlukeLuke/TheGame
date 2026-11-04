# Self-Improvement, the meta shop (draft r715)

Nothing built. The owner fills in `SELF_IMPROVEMENT.xlsx` (yellow columns); this page is the
shape it fills in.

- **Tokens** buy nodes that stay bought across runs. Tokens exist since r709 (`js/unlocks.js`: 1 a won run, 3 a mode, spent on Trick unlocks);
  whether this shop spends the same ones, and the 3-a-mode cap, is the sheet's Questions 1.
- **Getting in:** win to open it. **Journal** (1) puts it on the main menu. **Therapy** (2):
  respec freely, never during a run and never while the menu shows CONTINUE.
- **Before every run** a console line types "Good morning. What do you do before leaving for
  work?" and offers one Morning Routine card, taken or left. Free for everyone. It is a board
  screen (`boardScreenOpen`), typed at the game's text speed.
- **Three screens:** Morning Routine (anything but limits and stock), Breakfast (limits and
  stock), Lunch (mid-run, proposed start of Q3). Each grows the same way: 1 token = 2 shown,
  pick 1; +1 = 3 shown; +3 = pick 2 of 3.
- **Columns:** Wake Up (Get Up Early, Get Up Earlier, Beat the Alarm, Up Before Dawn,
  Polyphasic Sleep, Do Not Sleep), Diet (Breakfast's nodes shared with Wake Up, plus Lunch),
  Self Discipline (Focus: cap, start-of-round Focus, Focus from hands; entered from Diet's
  Intermittent Fasting too).
- **Base nerfs:** Focus Cap 30 to 15, Trick Slots 5 to 4, bought back by the first nodes.
  A base change is a `LIMITS_DEF` edit plus the nodes that restore it.
