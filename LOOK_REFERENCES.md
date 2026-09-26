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

---

# PART TWO — source-verified technique

Everything in this part I **fetched and read the actual CSS for**, from
`raw.githubusercontent.com`. Where I quote a declaration, that is the real
declaration, not a description of one.

## ★★ Cookie Clicker — the answer to "dark but not flat", shipping for 13 years
- <https://github.com/ozh/cookieclicker> (source mirror) · play: <https://orteil.dashnet.org/cookieclicker/>
- **DOM/CSS.** Canvas appears only as an old IE shim and in minigames.

This is your stated problem already solved, by the most-played dense dark
number-game on the web. Here is the entire `.framed` rule, verbatim:

```css
.framed, a.option, .sliderBox, .smallFramed {
  border: 1px solid #e2dd48;
  background-image: url(img/shadedBordersSoft.png), url(img/darkNoise.jpg);
  background-size: 100% 100%, auto;      /* frame stretched, noise TILED */
  background-color: #000;
  border-radius: 2px;
  box-shadow: 0 0 1px 2px rgba(0,0,0,.5),          /* contact */
              0 2px 4px rgba(0,0,0,.25),           /* ambient */
              0 0 2px 2px #000 inset,              /* inner well */
              0 1px 0 1px rgba(255,255,255,.5) inset;  /* TOP EDGE LIGHT */
  border-color: #ece2b6 #875526 #733726 #dfbc9a;   /* light top, dark bottom */
}
```

Read that against our diagnosis in `LOOK_DIRECTION.md`. It is, line for line:
a **tiled noise texture**, a **stretched frame overlay**, **four layered
shadows** (two outer, two inset), the **1px top inset highlight**, and an
**asymmetric bevel border**. The UX research called the top-edge highlight "the
highest value-per-byte technique in dark UI"; Cookie Clicker has shipped it
since 2013.

**The one thing we cannot do with CSS alone is the two images.** `darkNoise.jpg`
tiles and `shadedBordersSoft.png` stretches. Our previews fake the first with
`feTurbulence`, which is close, and fake the second with gradients, which is
not. Two small PNGs would close the gap.

## ★★ os-gui / 98.js — the institutional bevel as four tokens
- <https://github.com/1j01/os-gui> (256★) · <https://github.com/1j01/98> (1,426★)
- Live: <https://98.js.org> · **DOM/CSS**, vanilla.

Verified in `build/windows-98.css`:

```css
--ButtonHilight:  rgb(255,255,255);
--ButtonFace:     rgb(192,192,192);
--ButtonShadow:   rgb(128,128,128);
--ButtonDkShadow: rgb(0,0,0);

/* raised  */ border-color: var(--ButtonHilight) var(--ButtonShadow) var(--ButtonShadow) var(--ButtonHilight);
/* pressed */ border-color: var(--ButtonShadow) var(--ButtonHilight) var(--ButtonHilight) var(--ButtonShadow);
```

**One reversed border-color is the entire pressed state.** No glow, no scale, no
second colour. That is cheaper and more legible than what our reward tiles and
shop buttons currently do, and it is the single most "institutional" gesture
available. It drops straight into Direction B's beige chassis.

Also worth knowing: **os-gui loads real Windows `.theme` files at runtime.**
Given the dev panel is already full of live tuners, a theme-file loader is a
very on-brand way to make the look swappable.

## ★★ Slay the Web — our genre, in the DOM, split the way our `js/` is
- <https://github.com/oskarrough/slaytheweb> · play: <https://slaytheweb.cards>
- **DOM.** Astro + components. No canvas.

Its `src/ui/styles/` is split per concern exactly as our `js/` is split per
system: `card.css · fct.css · healthbar.css · map.css · overlay.css ·
targets.css · tooltipped.css · variables.css`.

Two techniques verified in source and both directly useful:

```css
/* card.css - a card that looks MANUFACTURED rather than drawn */
border: 0.5em ridge #53b5a8;
border-image-source: url(data:image/png;base64,iVBOR...);  /* tiny pixel PNG */
border-image-slice: 6 6 6 6;
border-image-repeat: repeat;
image-rendering: pixelated;
```

```css
/* card.css - lightening a colour without wrecking it */
box-shadow: 0 0 1.7rem color-mix(in oklab, var(--lightblue), white 30%);
```

**`border-image` with a base64 pixel PNG is the cheapest way to make a DOM card
look like an object.** Our `entityTileInner` floppy and business card are
gradients and `clip-path`; this is the missing ingredient.

**`color-mix(in oklab, …)` is strictly better than our manual channel math.**
It is what `_ptLighten` and `lineRingLighten` should be — and it would have made
the r302 near-white line problem (Echo Location's `#e0ddd0` becoming invisible)
a non-issue, because oklab preserves perceptual lightness.

Also verified in `fct.css`, next to our `PARTICLE_CFG`:

```css
.FCT { font-size: 5rem; animation: fct-up 3s cubic-bezier(0.23, 1, 0.32, 1);
       animation-fill-mode: both; text-shadow: .1rem .1rem 0 rgba(0,0,0,.5); }
/* 0%: scale(0)  10%: scale(1) translateY(-50%)  100%: translateY(-100%) rotateZ(15deg) */
```

Caveat: it is teal fantasy, not 1980s. Take the architecture, not the palette.

## Others worth the click

| | why |
|---|---|
| **[Bitburner](https://bitburner-official.github.io/)** ([src](https://github.com/bitburner-official/bitburner-src)) | DOM/React. A monospace institutional terminal wrapped around a screenful of live numbers — the closest match to our *information* problem. Ships a **theme system with named colour slots players edit in-game**. |
| **[WOPR CRT Terminal](https://github.com/alainfurter/woprcrt-terminal)** | DOM/React. The 1983 institutional terminal, with games inside it. **Steal the letter-by-letter typing delay** — we have no timed text reveal anywhere, and it is the cheapest period-correct atmosphere available. Its blue-on-black is also a reminder that 80s institutional is wider than green-and-amber. |
| **[Do It Lady](https://jasonhand.github.io/doitlady/)** ([src](https://github.com/jasonhand/doitlady)) | DOM/CSS, zero deps. **Tractor-feed dot-matrix paper with punch holes**, printing line by line. The payout screen is fictionally a remittance advice — it should print. A second *material* to contrast against dark glass is most of what stops everything being one dark panel. |
| **[A Dark Room](https://adarkroom.doublespeakgames.com)** ([src](https://github.com/doublespeakgames/adarkroom), 8.3k★) | DOM, literally zero `<canvas>`. Per-screen CSS split, same decision we made. Also **the exact "text on a plain dark background" you dislike** — 8,000 stars of proof that the structure works and the surface is what's missing. The best before/after we have. |
| **[Kittens Game](https://kittensgame.com/web/)** | DOM. Hundreds of simultaneously-updating numbers. Nobody has solved "many live numbers, one screen" more thoroughly — relevant to RECORDS and the Natural Scaling table. |
| **[PCjs](https://pcjs.org)** | Emulates real IBM 5150s, DEC VT100s, CP/M. **Ground truth for amber and green.** Check the palette against a real emulated monochrome monitor before committing — those two colours are easy to get slightly wrong. |
| **[FFmpeg-CRT-transform](https://github.com/viler-int10h/FFmpeg-CRT-transform)** | "CRT simulation without shaders, the slow way." Because nothing hides in a shader, **every artifact is a separate documented stage** — mask, grille, bloom, halation, curvature, bezel. The most legible explanation of the effect anywhere. |
| **[cool-retro-term](https://github.com/Swordfish90/cool-retro-term)** | Not browser. Its settings panel is the canonical *taxonomy*: phosphor, burn-in, static, jitter, glow-line, bloom, rasterization, curvature, ambient light. A checklist of what "CRT" decomposes into. |
| **[ditherer](https://github.com/gyng/ditherer)** | Runs in-browser. Ordered/Bayer dithering and 16-bit quantization are what actually read as PS1/PS2 rather than just "low-res". Prototype a dithered board before committing. |
| **[awesome-web-desktops](https://github.com/syxanash/awesome-web-desktops)** (2.1k★) | The index. Of these, **[Windows 1.0](https://win1.krnl386.com)** is genuinely 1985 and the most on-brief; **[CDE](https://toth.ighor.com/cde/)** is the Unix workstation dialect — beige, chiseled, humourless, and badly under-used. |

## Two corrections from verifying

- **`crawl.kelbi.org` is dead** (offline since April 2024) despite still ranking
  in search. The live DCSS WebTiles is <https://crawl.dcss.io>.
- **No Players Online** is a Windows download, not a browser game.

## The gap that remains

**itch.io and js13kgames were unreachable from this session entirely** — both
are blocked by the egress policy, for me and for the research agents. That is
where the analog-horror / office-horror / fake-OS indie work lives, and it is
probably the richest vein for this brief. Everything in Part One that points at
itch.io is search-result evidence only. js13k is completely unexplored, and
every entry there is ≤13KB with source included, which makes them unusually
readable.
