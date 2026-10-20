# Your Trick floppy art

Upload a picture here and every Trick's floppy disc uses it instead of the drawn one.
The Trick's own icon is still drawn on top of it, on the label.

## File names

Lower case, exactly as written:

| file | used for |
|---|---|
| `common.png` | Common Tricks |
| `rare.png` | Rare Tricks |
| `epic.png` | Epic Tricks |
| `legendary.png` | Legendary Tricks |
| `floppy.png` | any rarity that has no file of its own |

One `floppy.png` on its own covers every Trick. The drawn disc is coloured by rarity, so to keep
that, upload one per rarity (or `floppy.png` plus the ones you want to differ).

## The picture

- **PNG with a transparent background.**
- **400 x 380 pixels**, or any size in that shape (20 x 19 for pixel art, 800 x 760, ...).
  A different shape still works, but it is shrunk to fit and leaves gaps.
- **The icon goes in the box from (40, 166) to (360, 345)** on a 400 x 380 picture: the dashed
  box in `_guide.png`. Keep that area plain, like a label.
- `_template.png` is today's drawn disc at full size, to start from.
- **64 pixels wide or smaller counts as pixel art** and is drawn sharp instead of smoothed.
- An improved Trick still gets its gold stripes across the bottom-left corner.
- `_template.png` and `_guide.png` start with `_`, so the game never uses them.

## Uploading

1. Open this folder on GitHub: <https://github.com/NoFlukeLuke/TheGame/tree/main/assets/art/floppy>
2. **Add file -> Upload files**, drop the PNG in, keep the file name from the table.
3. **Commit changes.** The live site has it in a few minutes. A browser can keep showing the old
   picture for up to 10 minutes; a hard refresh (Ctrl+Shift+R) skips that.

To delete one, open the file on GitHub and use the bin icon; that Trick rarity goes back to the
drawn disc.

To compare with the drawn disc: dev panel -> HUD & Display -> Aesthetics -> **Floppy art**.
