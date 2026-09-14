"""Regenerate public/assets/og-image.png (1200x630) to match landing brand.

Usage:  python scripts/generate-og.py
Requires: Pillow (pip install pillow). No other dependencies.
"""
from __future__ import annotations

import os
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
INK = (24, 24, 27)        # zinc-900, wordmark
SUB = (82, 82, 91)        # zinc-600, tagline
BRAND = (91, 141, 239)    # ~hsl(220 90% 65%), brand-from
BG = (255, 255, 255)
DOT = (228, 228, 231)     # zinc-200 dot grid
DOMAIN = (161, 161, 170)  # zinc-400

_HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(_HERE)
OUT = os.path.join(ROOT, "public", "assets", "og-image.png")
ICON = os.path.join(ROOT, "public", "assets", "icon-128.png")

_FONT_FILES = [
    r"C:\Windows\Fonts\segoeuib.ttf",  # Segoe UI Bold
    r"C:\Windows\Fonts\segoeui.ttf",   # Segoe UI
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]


def font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    for path in _FONT_FILES:
        if ("Bold" in path) != bold:
            continue
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def main() -> None:
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    # Subtle dot grid like the landing hero.
    for y in range(28, H, 44):
        for x in range(28, W, 44):
            d.ellipse([x, y, x + 2, y + 2], fill=DOT)

    # Inset accent bar (echoes the old layout, refined).
    d.rounded_rectangle([72, 96, 84, H - 96], radius=6, fill=BRAND)

    # App icon.
    icon = Image.open(ICON).convert("RGBA").resize((176, 176), Image.LANCZOS)
    img.paste(icon, (148, 132), icon)

    # Wordmark next to icon.
    word = ImageFont.truetype(_FONT_FILES[0], 96) if os.path.exists(_FONT_FILES[0]) else font(96)
    d.text((356, 148), "SmoothScroll", font=word, fill=INK)

    # Tagline (landing hero copy).
    sub = font(46, bold=False)
    d.text((150, 348), "Smooth scrolling for Windows,", font=sub, fill=SUB)
    d.text((150, 408), "finally done right.", font=sub, fill=SUB)

    # Trust line.
    pill = font(32, bold=False)
    d.text((150, 500), "120 Hz easing   •   No telemetry   •   Open source", font=pill, fill=BRAND)
    dom = font(28, bold=False)
    d.text((150, 548), "smoothscroll.top", font=dom, fill=DOMAIN)

    img.save(OUT, "PNG")
    print(f"Wrote {OUT} ({W}x{H})")


if __name__ == "__main__":
    main()
