# tools/icons - the pixelater

Turns game-icons.net SVGs into the sprite sheet the entity tiles draw
(`assets/icons/entities.png`), the glyph map (`js/data/icons.js`) and the
credits file (`assets/icons/CREDITS.md`).

1. Get the icons once: `git clone --depth 1 https://github.com/game-icons/icons.git /tmp/game-icons`
   (a blobless clone works too: `--filter=blob:none --no-checkout`; the tool checks out what it needs).
2. Edit `manifest.js`: one row per emoji, the icon's name (`author/name`, or a bare name), a palette colour.
3. Run `node tools/icons/build.js --src /tmp/game-icons` (needs Playwright's Chromium; in the cloud
   session `NODE_PATH=/opt/node-tools/node_modules`). `--dump` prints every icon as text,
   `--contact out.png` writes a 4x contact sheet to look at, `--size 24` changes the grid.
4. Commit the three outputs with the manifest.

How a cell is made: the SVG is drawn at 512px, its white paint is the ink (a badge icon's black
picture on a white disc is not), the ink's box is fitted into the grid with a 1px margin, a cell is
ink when at least 42% of it is covered, and ink is shaded in three tones of the row's colour:
lit where the sky is above, shadow where nothing is below. `cut: true` on a row takes the holes
in the ink (a stencil) instead of the ink.
A row whose palette colour is light (luminance >= `--light`, 0.65: today cream and white) is
listed in `PX_ICON_LIGHT`; `emGlyph` tags it `.px-light` and css/px-icons.css outlines it, or it
vanishes on a light ground like the Trick's cream label.

The game keys icons by the EMOJI, not the entity, so two entities with one emoji share a picture.
A glyph with no row keeps its emoji. Dev -> HUD & Display -> Aesthetics -> Entity art switches
the whole set back to emoji for comparison.
