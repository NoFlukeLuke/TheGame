# Reference wall — browser games that fit the brief

Companion to `LOOK_DIRECTION.md`. Everything here was found by search; where I
could not confirm something I say so rather than guessing.

**One caveat up front, because it changes how to use this list.** Browser games
split into two kinds and only one of them teaches you anything:

| | what you get |
|---|---|
| **DOM / CSS** (real HTML elements) | open devtools and **read the actual technique** — the gradients, the shadows, the scanline recipe |
| **canvas / WebGL** (Unity, Godot, PICO-8, Phaser exports) | **pixels only.** Inspect element shows one `<canvas>`. Look reference, nothing more |

Most of the good-looking retro games on itch.io are Unity or Godot, so they are
mood board, not manual. The DOM ones are worth far more to you.

---

## ★ The one to look at first

### Margin Call — *financial survival roguelike, browser*
- <https://aflahit.itch.io/margin-call> · <https://margincall.io/>
- **DOM / CSS — inspectable.** Its own devlog quotes `.phosphor` /
  `.phosphor-strong` CSS classes and `text-amber-200`, which is a Tailwind
  class, so this is real styled DOM and you can read all of it in devtools.

This is the closest thing to your game that exists in a browser, on both axes at
once:

- **Same structure.** Built around "one escalating mechanic: the capital
  review — every few turns your equity must meet a rising target that grows
  exponentially." That is your quota curve and your manager review, with a
  different noun.
- **Same brief.** Its stated goal is a "Late Night 1987 CRT Terminal aesthetic"
  that reads as "a physical Quotron terminal in a dark room, **not a finance
  dashboard in a browser**" — which is precisely the gap you described between
  where the game is and where you want it.
- **It independently arrived at Direction B.** Amber phosphor, a 14px pure-black
  bezel, and a scanline field the devlog describes as a **4px / 1px repeating
  horizontal pattern** — an *integer* pitch, which is exactly the fix for the
  fractional-pitch problem in our own CRT.

Go read its CSS. It is the single highest-value hour available here.

---

## A · DOM / CSS — you can read the source

### 98.css — the plastic-instrument-panel manual
- <https://jdan.github.io/98.css/> (live demo) · <https://github.com/jdan/98.css> (9.1k stars)
- Pure CSS, no JavaScript. Styling for **bevels, sunken panels, raised vs.
  inset states, dotted focus rectangles, disabled appearance.**

Not 80s — it is Windows 98 — but the *technique* is exactly what Direction B's
beige chassis needs, and it is the best-documented open implementation of it.
The whole vocabulary of "this panel is raised, this one is recessed, this one is
a key you can press" is solved here in about 200 lines. Sister projects
**XP.css** and **7.css** do later eras.

**What to steal:** the bevel logic. A raised surface is a light top-left edge
and a dark bottom-right edge, an inset one is the reverse, and that single
inversion is what makes a control read as pressable without any other cue.

### Windows96.net
- <https://windows96.net/>
- HTML5 / CSS / JS / WebAssembly, browser-based, real DOM. *PC Gamer* called it
  "surprisingly fleshed out".

An entire fictional 9x-era OS as a web desktop. Worth it for how much chunky
plastic UI it sustains without becoming noise, and for the fact that it is all
DOM — which is proof that this look does not need a game engine.

### Windows 98 Web Edition
- <https://azayrahmad.github.io/win98-web/>
- GitHub Pages, so the source is right there.

A smaller, more readable version of the same idea.

---

## B · Canvas / engine builds — look only

These are Unity or similar. Inspect element gives you a `<canvas>` and nothing
useful, so treat them as mood board.

### Sneak '95
- <https://teamsneaky.itch.io/sneak-95>
- Playable in browser. **Unity → canvas.** Windows 95 / DOS / retro tagged.

### Secret Little Haven
- <https://ristar.itch.io/secret-little-haven>
- **Download only, not browser** — but worth knowing about. Its entire interface
  is "SanctuaryOS", a fictional 1999 operating system with a dozen working
  applications. One of the best examples anywhere of a game whose UI *is* the
  art direction.

### miniOS
- Browser-playable retro-computer simulator, found via itch's
  [computer + retro tag](https://itch.io/games/tag-computer/tag-retro).

---

## C · Live browse links — better than any fixed list

These are filtered queries, so they stay current instead of rotting:

- **Browser-playable roguelike deckbuilders** — a curated collection:
  <https://itch.io/c/3975323/roguelike-deckbuilder-browser>
- **Web + deckbuilder:** <https://itch.io/games/platform-web/tag-card-game/tag-deckbuilder>
- **HTML5 + terminal:** <https://itch.io/games/html5/tag-terminal>
- **Retro computer:** <https://itch.io/games/tag-computer/tag-retro>
- **Web + PSX look:** <https://itch.io/games/platform-web/tag-psx>
- **Haunted PS1** — the collective that drives the PS1/PS2 revival:
  <https://hauntedps1.itch.io/>

---

## What I could not check, and why

The container this session runs in only allows outbound traffic to a short list
of hosts. itch.io, js13kgames.com and margincall.io are all blocked from it, so
**I could not load any of these pages in a browser myself.** Everything above
comes from search results and from developer devlogs, which is good evidence for
*existence* and *description* but not for how a page looks today.

Concretely: the DOM-vs-canvas call is confident where a devlog names CSS
classes (Margin Call) or the project is a CSS library (98.css), and is an
inference from the engine tag elsewhere. Worth thirty seconds in devtools before
you invest time in any of them.

One thing that checking did change: **No Players Online** — the acclaimed
Haunted PS1 game — is a Windows download, not a browser game. I would have
listed it otherwise.

## The honest caveat on the whole category

The best executions of what you want — **Signalis**, **Control**,
**Hypnospace Outlaw**, **Lethal Company**'s terminal, **Inscryption** — are all
desktop games, none of them browser, and none of them CSS. If you want to see
the ceiling of this aesthetic you have to look there and then re-derive the
technique in CSS, which is what the three preview directions already do.

Margin Call and 98.css are the two exceptions where the look **and** the
technique are both readable, which is why they are at the top.
