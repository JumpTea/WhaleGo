#!/usr/bin/env python3
"""Generate the WhaleGo pixel-whale mark, sprite and social preview.

128x128 pixel grid, nearest-neighbour upscale. The whale is a compact,
side-view chibi: round head, small V fluke, pale belly, slit eyes, pink
cheeks and one cyan sonar earpiece. The silhouette follows the supplied
reference art; the earpiece is the WhaleGo-specific detail.

    python tools/brand/make-brand.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "assets" / "brand"
OUT.mkdir(parents=True, exist_ok=True)

INK = (7, 16, 32, 255)
BORDER = (27, 52, 84, 255)
OUTLINE = (20, 38, 96, 255)
BODY = (78, 111, 255, 255)
BODY_DARK = (52, 78, 204, 255)
BODY_HI = (108, 138, 255, 255)
BELLY = (224, 237, 255, 255)
BELLY_SHADE = (178, 210, 248, 255)
PINK = (255, 143, 184, 255)
SONAR = (54, 226, 199, 255)
SONAR_HI = (150, 255, 234, 255)
WHITE = (245, 248, 255, 255)
MUTED = (143, 166, 191, 255)

S = 128
FONT = "C:/Windows/Fonts/msyh.ttc"
FONT_B = "C:/Windows/Fonts/msyhbd.ttc"
FONT_EN = "C:/Windows/Fonts/segoeuib.ttf"
FONT_MONO = "C:/Windows/Fonts/consola.ttf"

BODY_POINTS = [
    (28, 48), (36, 40), (48, 36), (64, 36), (76, 40), (84, 46),
    (92, 48), (100, 48), (100, 68), (92, 72), (88, 88), (78, 100),
    (60, 104), (44, 104), (30, 98), (20, 88), (16, 76), (16, 60),
]

# Small, rounded two-lobe fluke. It is deliberately compact: no big scissors.
TAIL_POINTS = [
    (92, 58), (98, 54), (104, 50), (110, 48), (116, 50), (119, 56),
    (115, 60), (110, 62), (112, 66), (117, 70), (119, 76), (116, 81),
    (110, 80), (104, 74), (96, 68),
]

BELLY_POINTS = [
    (24, 80), (32, 76), (48, 76), (64, 78), (80, 80), (88, 88),
    (82, 98), (68, 102), (52, 102), (36, 98), (26, 90),
]


def _shift(points, dy):
    return [(x, y + dy) for x, y in points]


def _poly(d, points, fill, outline=OUTLINE, width=3):
    d.polygon(points, fill=fill, outline=outline, width=width)


def draw_whale(frame=0):
    """One 128x128 frame. 0-2 tail bob, 3 blink, 4 sonar pulse, 5 bubble."""
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    tail_dy = [0, -3, 2, 0, 0, -2][frame % 6]
    blink = frame % 6 == 3
    sonar = SONAR_HI if frame % 6 == 4 else SONAR

    _poly(d, _shift(TAIL_POINTS, tail_dy), BODY)
    _poly(d, BODY_POINTS, BODY)

    # Top light, clipped visually by drawing inside the body only.
    d.line([(36, 44), (52, 40), (68, 40), (82, 44)], fill=BODY_HI, width=3)

    d.polygon(BELLY_POINTS, fill=BELLY)
    d.line([(30, 96), (46, 100), (62, 100), (79, 96)], fill=BELLY_SHADE, width=4)

    # Small pectoral fin.
    _poly(d, [(70, 84), (81, 87), (86, 96), (77, 100), (67, 93)], BODY_DARK, width=3)

    # Two vertical slit eyes.
    if blink:
        d.rectangle((44, 60, 47, 60), fill=OUTLINE)
        d.rectangle((66, 60, 69, 60), fill=OUTLINE)
    else:
        d.rectangle((44, 56, 47, 66), fill=OUTLINE)
        d.rectangle((66, 56, 69, 66), fill=OUTLINE)
        d.point((44, 56), fill=WHITE)
        d.point((66, 56), fill=WHITE)

    # Pink cheeks.
    d.rectangle((32, 72, 38, 75), fill=PINK)
    d.rectangle((74, 72, 80, 75), fill=PINK)

    # A tiny smile, kept above the belly so it does not read as a mouth line.
    d.line([(50, 70), (54, 73), (58, 70)], fill=OUTLINE, width=2)

    # WhaleGo detail: one cyan sonar earpiece.
    d.rounded_rectangle((22, 58, 34, 76), radius=4, fill=OUTLINE)
    d.rectangle((26, 64, 30, 71), fill=sonar)
    d.point((26, 64), fill=WHITE)

    if frame % 6 == 4:
        d.point((16, 52), fill=SONAR_HI)
        d.point((14, 62), fill=SONAR_HI)
        d.point((18, 70), fill=SONAR_HI)

    # Cyan water line.
    for x0, x1 in [(24, 40), (48, 64), (72, 88), (96, 108)]:
        d.line([(x0, 116), (x1, 116)], fill=SONAR, width=2)
    for x, y in [(30, 112), (44, 114), (58, 112), (72, 114), (86, 112), (100, 114)]:
        d.point((x, y), fill=SONAR)
    if frame % 6 == 5:
        d.rectangle((96, 100, 99, 103), fill=SONAR)
        d.rectangle((102, 94, 105, 97), fill=SONAR)
    return img


def scaled(frame, scale):
    return frame.resize((S * scale, S * scale), Image.NEAREST)


def rings(draw, cx, cy, r, color, count=4, step=34, width=1):
    for i in range(count):
        rr = r + i * step
        draw.arc((cx - rr, cy - rr, cx + rr, cy + rr), 200, 340, fill=color, width=width)


def logo_square(size, scale, transparent=False):
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(canvas)
    if not transparent:
        d.rounded_rectangle(
            (0, 0, size - 1, size - 1),
            radius=int(size * 0.18),
            fill=INK,
            outline=BORDER,
            width=max(1, size // 256),
        )
        rings(d, size // 2, int(size * 0.46), int(size * 0.21), (24, 66, 74, 255), count=3,
              step=int(size * 0.08), width=max(1, size // 512))
        for y in range(int(size * 0.1), int(size * 0.9), int(size * 0.1)):
            d.line([(int(size * 0.08), y), (int(size * 0.92), y)], fill=(10, 24, 44, 255), width=1)
    whale = scaled(draw_whale(0), scale)
    x = (size - whale.width) // 2
    y = (size - whale.height) // 2
    canvas.alpha_composite(whale, (x, y))
    return canvas


def social_preview():
    width, height = 1280, 640
    img = Image.new("RGBA", (width, height), INK)
    d = ImageDraw.Draw(img)
    for x in range(0, width, 48):
        d.line([(x, 0), (x, height)], fill=(10, 24, 44, 255), width=1)
    for y in range(0, height, 48):
        d.line([(0, y), (width, y)], fill=(10, 24, 44, 255), width=1)
    rings(d, 300, 330, 190, (24, 66, 74, 255), count=4, step=54, width=2)

    icon = logo_square(400, 3)
    img.alpha_composite(icon, (100, 120))

    title = ImageFont.truetype(FONT_EN, 112)
    cn = ImageFont.truetype(FONT_B, 38)
    tag = ImageFont.truetype(FONT, 34)
    small = ImageFont.truetype(FONT, 24)
    mono = ImageFont.truetype(FONT_MONO, 20)

    d.text((592, 128), "WhaleGo", font=title, fill=WHITE, anchor="la")
    d.text((596, 258), "鲸语", font=cn, fill=SONAR, anchor="la")
    d.line((596, 322, 1180, 322), fill=(54, 226, 199, 110), width=2)
    d.text((596, 348), "先听见，再看见。", font=tag, fill=MUTED, anchor="la")
    d.text((596, 410), "DSH-Go 双脑语音插件 · MIT", font=small, fill=MUTED, anchor="la")
    d.text((596, 470), "github.com/JumpTea/WhaleGo", font=mono, fill=(143, 166, 191, 255), anchor="la")
    return img


def sprite_sheet():
    scale = 2
    frames = [draw_whale(i) for i in range(6)]
    sheet = Image.new("RGBA", (S * scale * 6, S * scale), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        sheet.alpha_composite(scaled(frame, scale), (i * S * scale, 0))
    return sheet


def main():
    for size, scale in ((1024, 8), (512, 4), (256, 2), (128, 1)):
        logo_square(size, scale).save(OUT / f"pixel-whale-{size}.png")
    logo_square(1024, 8, transparent=True).save(OUT / "pixel-whale-mark-1024.png")
    social_preview().save(OUT / "social-preview-1280x640.png")
    sprite_sheet().save(OUT / "sprite-whale.png")
    preview = Image.new("RGBA", (S * 2 * 6, S * 2), (7, 16, 32, 255))
    for i, frame in enumerate([draw_whale(i) for i in range(6)]):
        preview.alpha_composite(scaled(frame, 2), (i * S * 2, 0))
    preview.save(OUT / "sprite-preview.png")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
