#!/usr/bin/env python3
"""
Draws og.png - the 1200x630 card Slack, iMessage, X and LinkedIn show when
somebody pastes a mydailies.app link.

Run it from the root of this repo:

    python3 tools/make-og.py

It needs Pillow and the four brand fonts. It downloads the fonts from the
Google Fonts repo into a cache directory the first time and reuses them after,
so nothing font-shaped has to be checked in.

The colours below are the same tokens index.html and doc.css declare, and the
ridge is the same curve index.html draws live on its hero canvas - the
ridgeY() here is a transcription of the one in that file's <script>. Change a
token in the CSS and change it here too, or the card drifts away from the site
it is advertising.
"""

import os
import sys
import urllib.request
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "og.png")
ICON = os.path.join(ROOT, "icon.png")
CACHE = os.path.join(os.path.expanduser("~"), ".cache", "dailies-og-fonts")

W, H = 1200, 630
SS = 2  # supersample, then downscale - Pillow has no antialiased polygon fill

# ---- tokens, dark ("the app icon is a night scene") ----
GROUND      = (0x19, 0x1c, 0x1d)
GROUND_DEEP = (0x10, 0x13, 0x14)
TEXT        = (0xf0, 0xe6, 0xd2)
TEXT_DIM    = (0xae, 0xaa, 0x9c)
ACCENT      = (0x9d, 0xb0, 0x81)
ACCENT_DIM  = (0x7d, 0x8f, 0x63)
HILL        = (0x4f, 0x5d, 0x3c)

FONTS = {
    "display":        "ofl/fraunces/Fraunces%5BSOFT%2CWONK%2Copsz%2Cwght%5D.ttf",
    "display-italic": "ofl/fraunces/Fraunces-Italic%5BSOFT%2CWONK%2Copsz%2Cwght%5D.ttf",
    "body":           "ofl/figtree/Figtree%5Bwght%5D.ttf",
    "mono":           "ofl/courierprime/CourierPrime-Regular.ttf",
}
BASE = "https://github.com/google/fonts/raw/main/"


def font_file(key):
    path = os.path.join(CACHE, key + ".ttf")
    if not os.path.exists(path):
        os.makedirs(CACHE, exist_ok=True)
        sys.stderr.write("fetching %s ...\n" % key)
        urllib.request.urlretrieve(BASE + FONTS[key], path)
    return path


def load(key, size, weight=None, opsz=None):
    f = ImageFont.truetype(font_file(key), size)
    # Fraunces and Figtree ship as variable fonts; without this they render at
    # their default instance, which for Fraunces is a light optical size.
    axes = []
    try:
        for a in f.get_variation_axes():
            name = a["name"]
            name = name.decode() if isinstance(name, bytes) else name
            lo, hi = a["minimum"], a["maximum"]
            if name.strip().lower() == "weight" and weight is not None:
                axes.append(max(lo, min(hi, weight)))
            elif name.strip().lower() in ("optical size", "opsz") and opsz is not None:
                axes.append(max(lo, min(hi, opsz)))
            else:
                axes.append(a["default"])
        if axes:
            f.set_variation_by_axes(axes)
    except OSError:
        pass  # a static font - nothing to set
    return f


def ridge_y(x, k, w, h, top):
    """Transcribed from the hero canvas in index.html. t is fixed at 0."""
    import math
    u = x / max(w, 1)
    crest = h * 0.32 + k * (h * 0.055)
    return top + (
        crest
        + math.sin(u * 4.1 + k * 0.30) * (h * 0.085)
        + math.sin(u * 7.6 + k * 0.17) * (h * 0.038)
        + math.sin(u * 1.7) * (h * 0.045)
    )


def tracked(draw, xy, text, font, fill, tracking):
    """Pillow has no letter-spacing. .eyebrow and .doc-meta both need one."""
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        x += draw.textlength(ch, font=font) + tracking
    return x


def rounded_icon(size, radius):
    im = Image.open(ICON).convert("RGBA").resize((size, size), Image.LANCZOS)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius, fill=255)
    im.putalpha(mask)
    return im


def main():
    w, h = W * SS, H * SS
    img = Image.new("RGB", (w, h), GROUND_DEEP)
    d = ImageDraw.Draw(img)

    # Night sky: ground-deep at the top easing into ground behind the hills.
    for y in range(h):
        t = y / h
        d.line(
            [(0, y), (w, y)],
            fill=tuple(round(a + (b - a) * t) for a, b in zip(GROUND_DEEP, GROUND)),
        )

    # ---- the ridge ----
    rh = 230 * SS
    rtop = h - rh
    step = 3 * SS

    pts = [(x, ridge_y(x, 0, w, rh, rtop)) for x in range(0, w + step, step)]
    d.polygon(pts + [(w, h), (0, h)], fill=HILL)

    # The contour lines are the ground colour at 34%, exactly as the canvas
    # draws them. They only ever fall below the k=0 crest, so everything above
    # the ridge stays clear for type.
    lines = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ld = ImageDraw.Draw(lines)
    for k in range(1, 26):
        ld.line(
            [(x, ridge_y(x, k, w, rh, rtop)) for x in range(0, w + step, step)],
            fill=GROUND + (87,),
            width=round(1.2 * SS),
        )
    img = Image.alpha_composite(img.convert("RGBA"), lines).convert("RGB")
    d = ImageDraw.Draw(img)

    # ---- brand ----
    icon_px = 74 * SS
    img.paste(rounded_icon(icon_px, 20 * SS), (76 * SS, 62 * SS), rounded_icon(icon_px, 20 * SS))
    f_brand = load("body", 36 * SS, weight=600)
    d.text((168 * SS, 82 * SS), "Dailies", font=f_brand, fill=TEXT)

    # ---- eyebrow: the rule, then mono caps, as .eyebrow renders it ----
    ey = 208 * SS
    d.line([(76 * SS, ey + 9 * SS), (110 * SS, ey + 9 * SS)], fill=ACCENT_DIM, width=max(1, SS))
    f_eye = load("mono", 19 * SS)
    tracked(d, (126 * SS, ey), "A LITTLE SOMETHING, EVERY DAY", f_eye, ACCENT, 2.7 * SS)

    # ---- headline, the landing page's own h1 ----
    f_h1 = load("display", 62 * SS, weight=400, opsz=60)
    f_h1i = load("display-italic", 62 * SS, weight=400, opsz=60)
    d.text((76 * SS, 248 * SS), "Daily motivation, straight", font=f_h1, fill=TEXT)
    x = d.text((76 * SS, 320 * SS), "to your ", font=f_h1, fill=TEXT)
    x = 76 * SS + d.textlength("to your ", font=f_h1)
    d.text((x, 320 * SS), "Lock Screen.", font=f_h1i, fill=ACCENT)

    # ---- the url, sitting on the hills ----
    f_url = load("mono", 21 * SS)
    tracked(d, (76 * SS, 546 * SS), "mydailies.app", f_url, TEXT, 1.6 * SS)

    img.resize((W, H), Image.LANCZOS).save(OUT, optimize=True)
    print("wrote %s (%d x %d)" % (OUT, W, H))


if __name__ == "__main__":
    main()
