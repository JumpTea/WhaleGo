#!/usr/bin/env python3
"""Generate the WhaleGo pixel-whale mark and social preview.

The mark is drawn on a 64x64 grid and scaled with nearest-neighbour so every
edge stays a hard pixel. Run from the repository root:

    python tools/brand/make-brand.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "assets" / "brand"
OUT.mkdir(parents=True, exist_ok=True)

INK = (7, 22, 38, 255)
INK_2 = (10, 31, 54, 255)
BORDER = (27, 63, 98, 255)
BODY = (38, 111, 240, 255)
BODY_DARK = (20, 69, 172, 255)
BELLY = (150, 216, 255, 255)
HILITE = (206, 240, 255, 255)
SONAR = (54, 226, 199, 255)
WHITE = (240, 250, 255, 255)
DARK = (4, 14, 24, 255)

S = 64


def blank():
    return Image.new("RGBA", (S, S), (0, 0, 0, 0))


def put(px, x, y, color):
    if 0 <= x < S and 0 <= y < S:
        px[x, y] = color


def rect(px, x0, y0, x1, y1, color):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            put(px, x, y, color)


def ellipse(px, cx, cy, rx, ry, color):
    for y in range(cy - ry, cy + ry + 1):
        for x in range(cx - rx, cx + rx + 1):
            dx = (x - cx) / rx
            dy = (y - cy) / ry
            if dx * dx + dy * dy <= 1.02:
                put(px, x, y, color)


def polygon(px, points, color):
    min_y = min(y for _, y in points)
    max_y = max(y for _, y in points)
    for y in range(min_y, max_y + 1):
        xs = []
        for i in range(len(points)):
            x1, y1 = points[i]
            x2, y2 = points[(i + 1) % len(points)]
            if y1 == y2:
                continue
            if min(y1, y2) <= y < max(y1, y2):
                t = (y - y1) / (y2 - y1)
                xs.append(x1 + t * (x2 - x1))
        if not xs:
            continue
        for x in range(int(min(xs) + 0.5), int(max(xs) + 0.5) + 1):
            put(px, x, y, color)


def line(px, x0, y0, x1, y1, color):
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx = 1 if x0 < x1 else -1
    sy = 1 if y0 < y1 else -1
    err = dx + dy
    while True:
        put(px, x0, y0, color)
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy


def rounded_bg(img):
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=12, fill=255)
    bg = Image.new("RGBA", (S, S), INK)
    img.paste(bg, (0, 0), mask)
    ImageDraw.Draw(img).rounded_rectangle([0, 0, S - 1, S - 1], radius=12, outline=BORDER, width=1)
    px = img.load()
    for y in range(4, S, 8):
        for x in range(6, S - 6):
            if px[x, y][3] and px[x, y] == INK:
                px[x, y] = INK_2


def whale(img, body_color=BODY, belly_color=BELLY, with_sonar=True, transparent=False):
    # A chubby side-view whale: one big eye, a pale belly, a V-shaped fluke,
    # and the character's own sonar antenna. The antenna and cyan cheek keep
    # the silhouette away from any existing registered whale mascot.
    d = ImageDraw.Draw(img)

    # Tail fluke behind the body: a single V-cut shape, not two floating lobes.
    d.polygon(
        [(40, 22), (46, 10), (54, 6), (60, 10), (60, 16), (54, 26),
         (49, 32), (54, 38), (60, 48), (60, 54), (54, 58), (46, 54), (40, 42)],
        fill=body_color, outline=DARK,
    )

    # Body and left flipper.
    d.rounded_rectangle((8, 18, 48, 52), radius=16, fill=body_color, outline=DARK, width=2)
    d.ellipse((2, 36, 12, 46), fill=body_color, outline=DARK, width=2)

    # Belly and its soft top highlight.
    d.ellipse((12, 34, 44, 52), fill=belly_color)
    d.arc((14, 35, 42, 50), 200, 340, fill=HILITE, width=1)

    # One big eye with a corner glint.
    d.rectangle((20, 28, 23, 31), fill=DARK)
    d.point((20, 28), fill=WHITE)

    # Cyan sonar cheek and a small smile.
    d.rectangle((27, 37, 30, 38), fill=SONAR)
    d.line((16, 40, 20, 42), fill=DARK, width=1)
    d.line((20, 42, 24, 40), fill=DARK, width=1)

    # Sonar antenna: a dark stalk and a glowing orb with two ripple pixels.
    if with_sonar:
        d.rectangle((31, 8, 32, 18), fill=DARK)
        d.ellipse((29, 2, 34, 7), fill=SONAR, outline=DARK, width=1)
        d.point((30, 3), fill=HILITE)
        d.point((27, 6), fill=SONAR)
        d.point((36, 6), fill=SONAR)


def mark(transparent=False):
    img = blank()
    px = img.load()
    if not transparent:
        rounded_bg(img)
    whale(img, with_sonar=True, transparent=transparent)
    return img


def save(img, name, size):
    img.resize((size, size), Image.Resampling.NEAREST).save(OUT / name)


def font(path, size, index=0):
    return ImageFont.truetype(path, size, index=index)


def social():
    width, height = 1280, 640
    img = Image.new("RGBA", (width, height), INK)
    draw = ImageDraw.Draw(img, "RGBA")
    for x in range(0, width, 32):
        draw.line([(x, 0), (x, height)], fill=(18, 45, 72, 90), width=1)
    for y in range(0, height, 32):
        draw.line([(0, y), (width, y)], fill=(18, 45, 72, 90), width=1)
    # The mark already carries its own sonar; keep the card background quiet.
    logo = mark().resize((320, 320), Image.Resampling.NEAREST)
    img.alpha_composite(logo, (40, 160))
    cn = font("C:/Windows/Fonts/msyhbd.ttc", 96)
    en = font("C:/Windows/Fonts/consolab.ttf", 48)
    tag = font("C:/Windows/Fonts/msyh.ttc", 32)
    url = font("C:/Windows/Fonts/consola.ttf", 22)
    draw.text((440, 120), "鲸语", font=cn, fill=WHITE)
    draw.text((442, 268), "WhaleGo", font=en, fill=SONAR)
    draw.rectangle([440, 344, 1120, 345], fill=(54, 226, 199, 120))
    draw.text((444, 370), "先听见，再看见。", font=tag, fill=(200, 228, 246, 255))
    draw.text((444, 430), "DSH-Go 双脑语音插件 · MIT", font=tag, fill=(138, 184, 220, 255))
    draw.text((444, 500), "github.com/JumpTea/WhaleGo", font=url, fill=(120, 190, 220, 255))
    img.convert("RGB").save(OUT / "social-preview-1280x640.png")


if __name__ == "__main__":
    base = mark()
    save(base, "pixel-whale-1024.png", 1024)
    save(base, "pixel-whale-512.png", 512)
    save(base, "pixel-whale-256.png", 256)
    save(base, "pixel-whale-128.png", 128)
    mark(transparent=True).resize((1024, 1024), Image.Resampling.NEAREST).save(OUT / "pixel-whale-mark-1024.png")
    social()
    print("wrote", OUT)
