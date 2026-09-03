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
    // ── Office ambience (r186) ──
    // The long recordings from assets/ambience/. They are beds, not one-shot
    // effects: 8 to 54 seconds of drive whirr, typing and dial tone, which is
    // exactly what the cubicle on the menu wants behind it. They all carry
    // `off: true` so the playlist starts silent and you switch on the ones you
    // like rather than meeting twelve at once.
    { id: 'amb_hddstart', title: 'Hard drive spinning up', file: 'assets/ambience/hard-drive-start.mp3',  scene: 'menu', off: true },
    { id: 'amb_hddfail',  title: 'Failing hard drive',     file: 'assets/ambience/hard-drive-failing.mp3', scene: 'menu', off: true },
    { id: 'amb_disc',     title: 'Mechanical disc',        file: 'assets/ambience/mechanical-disc.mp3',    scene: 'menu', off: true },
    { id: 'amb_diskfail', title: 'Disk loading, failing',  file: 'assets/ambience/disk-loading-fail.mp3',  scene: 'menu', off: true },
    { id: 'amb_dvd',      title: 'DVD drive spin',         file: 'assets/ambience/dvd-spin.mp3',           scene: 'menu', off: true },
    { id: 'amb_floppy',   title: 'Reading a floppy',       file: 'assets/ambience/floppy-read.mp3',        scene: 'menu', off: true },
    { id: 'amb_grind',    title: 'Startup grind',          file: 'assets/ambience/startup-grind.mp3',      scene: 'menu', off: true },
    { id: 'amb_think',    title: 'Console thinking',       file: 'assets/ambience/console-thinking.mp3',   scene: 'menu', off: true },
    { id: 'amb_dial',     title: 'Dial tone',              file: 'assets/ambience/phone-dial-tone.mp3',    scene: 'menu', off: true },
    { id: 'amb_type1',    title: 'Typing (short)',         file: 'assets/ambience/typing-short.mp3',       scene: 'any',  off: true },
    { id: 'amb_type2',    title: 'Typing (long)',          file: 'assets/ambience/typing-long.mp3',        scene: 'any',  off: true },
    { id: 'amb_clock',    title: 'Clock tick',             file: 'assets/ambience/clock-tick.mp3',         scene: 'game', off: true },
  ],

  // ── SOUND EFFECTS ────────────────────────────────────────────────────────
  // id: 'path/to/file'. The ids are listed in Settings -> Sound effects, and in
  // SFX_CATALOG in js/audio-assets.js.
  //
  // Example:
  //   card_select: 'assets/sfx/card-select.wav',
  //   coin:        'assets/sfx/coin.mp3',
  sfx: {
    // ── Your uploads (r186) ──
    // Only the short one-shots are here; anything over about two seconds is a bed,
    // not an effect, and lives in the music list above instead.
    card_pop:      'assets/sfx/single-card.mp3',        // one card scoring
    card_select:   'assets/sfx/card-select.mp3',        // tapping a card
    flip_shuffle:  'assets/sfx/cards-falling.mp3',      // the hand flying to the preview
    reward_select: 'assets/sfx/cork-pop.mp3',           // picking a reward-grid tile
    round_start:   'assets/sfx/floppy-insert.mp3',      // a round begins

    // A GUESS, easy to move: "good sound, pitch down" reads as the good sound
    // pitched down for the bad outcome. If it is meant to be positive, change
    // this key to reward_good.
    reward_bad:    'assets/sfx/good-pitched-down.mp3',

    // assets/sfx/spacebar-click.mp3 is unassigned - it did not obviously belong
    // to any id. Point one at it whenever you decide which.
  },
};
