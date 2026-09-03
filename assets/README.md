# assets/ - your own sound, music and images

Everything in here is a plain file the browser downloads at run time. There is no
build step: drop a file in the right folder, list it in `js/data/audio-manifest.js`,
push, and GitHub Pages serves it.

## Folders

| folder | what goes in it |
|---|---|
| `assets/music/`    | background music tracks (`.mp3`, `.ogg`, `.m4a`) |
| `assets/sfx/`      | short one-shot sound effects, under about 2 seconds |
| `assets/ambience/` | long beds - room tone, machine hum - played as tracks |

**Short effect or long bed?** Anything much over two seconds is a bed, not an
effect: it will still be playing when the next one fires. Put those in
`assets/ambience/` and list them in the `music` block, where they get their own
on/off switch. `off: true` on a track means it starts switched off.

## Adding a music track

1. Put the file in `assets/music/`, e.g. `assets/music/lobby-hum.mp3`.
2. Add one line to the `music` list in `js/data/audio-manifest.js`.
3. It shows up in Settings -> Music playlist, where it can be switched on or off.

## Replacing a sound effect

Every sound in the game has an id (see Settings -> Sound effects). Put a file in
`assets/sfx/` and point that id at it in the `sfx` block of the manifest.

Sounds resolve in this order, first hit wins:

1. switched off in Settings -> silence
2. **Use my sound files** is on and a file is listed -> your file
3. a **sound pack** is chosen and covers it -> the pack's version
4. otherwise -> the classic coded sound

So a file only ever replaces the one id it is listed under, a bad path falls back
rather than going silent, and the whole lot can be switched off at once with the
**Use my sound files** toggle.

## Sound packs

Settings -> Audio -> Sound pack, or the switcher at the top of the sound board:

- **Classic** - the original synthesised set.
- **1-bit** - one square wave, hard on and off, like a ZX Spectrum beeper.
- **Arcade** - an 8-bit slot machine: reel clicks, coin counters, jackpots.

## Rules of thumb

- **Keep files small.** Under ~4 MB per music track, under ~200 KB per effect.
  The whole game is downloaded every visit and GitHub Pages caps a repo at 1 GB.
- **Use MP3** unless you have a reason not to. Every browser plays it.
- **Only upload audio you have the right to use.** This site is public.
- Filenames: lower case, dashes instead of spaces, no accents.
