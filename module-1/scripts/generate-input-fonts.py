"""Generate caret-aligned Benzin faces. Requires fonttools and brotli.

Only vertical metrics and family names change; glyphs and horizontal metrics
remain identical to assets/fonts/Benzin-Bold.woff2.
"""

from pathlib import Path

from fontTools.ttLib import TTFont


FONT_DIR = Path(__file__).resolve().parent.parent / "assets" / "fonts"
SOURCE = FONT_DIR / "Benzin-Bold.woff2"

# Original ascent/descent: 770/-230, unitsPerEm: 1000.
# Desktop: move the baseline down by 4px at 24px with a centered caret.
FACES = [
    ("Benzin Input", "Benzin-Input-Bold.woff2", 937, 63),
]


for family, filename, ascent, descent in FACES:
    font = TTFont(SOURCE)
    assert font["head"].unitsPerEm == 1000, "Recalculate metrics for this font."
    font["hhea"].ascent = ascent
    font["hhea"].descent = -descent
    font["hhea"].lineGap = 0
    font["OS/2"].sTypoAscender = ascent
    font["OS/2"].sTypoDescender = -descent
    font["OS/2"].sTypoLineGap = 0
    font["OS/2"].fsSelection |= 1 << 7  # USE_TYPO_METRICS across platforms.
    # Preserve winAscent/winDescent: accented glyphs retain their ink bounds.
    for record in font["name"].names:
        values = {
            1: family,
            2: "Bold",
            3: f"{family} Bold",
            4: f"{family} Bold",
            6: family.replace(" ", "-") + "-Bold",
            16: family,
            17: "Bold",
        }
        if record.nameID in values:
            record.string = values[record.nameID].encode(record.getEncoding())
    font.flavor = "woff2"
    font.save(FONT_DIR / filename)

