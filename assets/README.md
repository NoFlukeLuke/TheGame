# assets/ - your own sound, music and images

Everything in here is a plain file the browser downloads at run time. There is no
build step: drop a file in the right folder, list it in `js/data/audio-manifest.js`,
push, and GitHub Pages serves it.

## Folders

| folder | what goes in it |
|---|---|
| `assets/music/` | background music tracks (`.mp3`, `.ogg`, `.m4a`) |
| `assets/sfx/`   | individual sound effects (`.mp3`, `.wav`, `.ogg`) |

## Adding a music track

1. Put the file in `assets/music/`, e.g. `assets/music/lobby-hum.mp3`.
2. Add one line to the `music` list in `js/data/audio-manifest.js`.
3. It shows up in Settings -> Music playlist, where it can be switched on or off.

## Replacing a sound effect

Every sound in the game has an id (see Settings -> Sound effects). Put a file in
`assets/sfx/` and point that id at it in the `sfx` block of the manifest. Ids that
are not listed keep using the coded (synthesised) sound, so you can replace them
one at a time.

## Rules of thumb

- **Keep files small.** Under ~4 MB per music track, under ~200 KB per effect.
  The whole game is downloaded every visit and GitHub Pages caps a repo at 1 GB.
- **Use MP3** unless you have a reason not to. Every browser plays it.
- **Only upload audio you have the right to use.** This site is public.
- Filenames: lower case, dashes instead of spaces, no accents.
