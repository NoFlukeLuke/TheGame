// ══════════════════════════════════════════════
// AUDIO MANIFEST (r185) - the one file to edit when you add your own audio
// ══════════════════════════════════════════════
// Pure data, no logic. Drop files into assets/music/ or assets/sfx/, list them
// here, and the game picks them up on the next load. Nothing else needs editing.
//
// The engine treats a listed file as an OVERRIDE: an id that appears in `sfx`
// plays your file, an id that does not keeps the coded (synthesised) sound. So
// you can replace the sounds you dislike one at a time and leave the rest.
//
// If a file is listed but missing or unplayable, the game logs it once and falls
// back to the coded sound. A broken path never stops the game.

const AUDIO_MANIFEST = {

  // ── MUSIC ────────────────────────────────────────────────────────────────
  // One entry per track. Order here is the playlist order.
  //   id     - short unique name, no spaces (used to remember on/off)
  //   title  - what the playlist shows
  //   file   - path from the repo root
  //   scene  - 'menu' (main menu only), 'game' (in a run only), 'any' (both)
  //   artist - optional, shown under the title
  //
  // Example:
  //   { id: 'lobby',  title: 'Lobby Hum',   file: 'assets/music/lobby-hum.mp3', scene: 'menu' },
  //   { id: 'grind',  title: 'Night Shift', file: 'assets/music/night-shift.mp3', scene: 'game' },
  music: [
  ],

  // ── SOUND EFFECTS ────────────────────────────────────────────────────────
  // id: 'path/to/file'. The ids are listed in Settings -> Sound effects, and in
  // SFX_CATALOG in js/audio-assets.js.
  //
  // Example:
  //   card_select: 'assets/sfx/card-select.wav',
  //   coin:        'assets/sfx/coin.mp3',
  sfx: {
  },
};
