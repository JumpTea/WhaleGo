#!/usr/bin/env python3
"""Render the WhaleGo 75-second product film.

All frames are drawn from scratch: no app screenshots, no personal data.
Output: assets/promo/whalego-promo.mp4 (after audio mux).
"""
from __future__ import annotations

import math
import os
import random
import shutil
import subprocess
import sys
import wave
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
BRAND = ROOT / "assets" / "brand"
PROMO = ROOT / "assets" / "promo"
VOICE = PROMO / "voice"
STILLS = PROMO / "stills"
FRAMES = PROMO / "frames"

W, H = 1920, 1080
FPS = 30
DUR = 75.0
TOTAL = int(DUR * FPS)

INK = (7, 19, 31, 255)
INK_2 = (10, 26, 41, 255)
DEEP = (4, 10, 18, 255)
WHALE = (47, 123, 255, 255)
WHALE_HI = (125, 180, 255, 255)
CYAN = (87, 224, 192, 255)
AMBER = (255, 196, 107, 255)
MIST = (216, 231, 245, 255)
MUTED = (143, 169, 189, 255)
LINE = (41, 66, 88, 255)

FONT_REG = "C:/Windows/Fonts/msyh.ttc"
FONT_BOLD = "C:/Windows/Fonts/msyhbd.ttc"
FONT_MONO = "C:/Windows/Fonts/consola.ttf"
FONT_MONO_B = "C:/Windows/Fonts/consolab.ttf"
_FFMPEG = os.environ.get("FFMPEG") or shutil.which("ffmpeg") or "ffmpeg"

_fonts: dict[tuple[str, int], ImageFont.FreeTypeFont] = {}


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    key = (path, size)
    if key not in _fonts:
        _fonts[key] = ImageFont.truetype(path, size)
    return _fonts[key]


def rgba(color, alpha=255):
    if len(color) == 4:
        return (color[0], color[1], color[2], int(alpha))
    return (color[0], color[1], color[2], int(alpha))


def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def smooth(x):
    x = clamp(x)
    return x * x * (3 - 2 * x)


def span(t, a, b):
    if b <= a:
        return 1.0 if t >= b else 0.0
    return smooth((t - a) / (b - a))


def fade_out(t, a, b):
    return 1.0 - span(t, a, b)


def lerp(a, b, k):
    return a + (b - a) * k


def mix(c1, c2, k):
    k = clamp(k)
    return tuple(int(lerp(c1[i], c2[i], k)) for i in range(3)) + (255,)


def text_width(draw: ImageDraw.ImageDraw, s: str, f: ImageFont.FreeTypeFont) -> int:
    box = draw.textbbox((0, 0), s, font=f)
    return box[2] - box[0]


def wrap(draw: ImageDraw.ImageDraw, s: str, f: ImageFont.FreeTypeFont, max_w: int) -> list[str]:
    lines: list[str] = []
    for raw in s.split("\n"):
        if not raw:
            lines.append("")
            continue
        cur = ""
        for ch in raw:
            trial = cur + ch
            if text_width(draw, trial, f) <= max_w or not cur:
                cur = trial
            else:
                lines.append(cur)
                cur = ch
        lines.append(cur)
    return lines


def draw_text(
    draw: ImageDraw.ImageDraw,
    xy,
    s: str,
    size: int,
    color,
    bold=False,
    anchor="la",
    max_w=None,
    spacing=10,
    align="left",
):
    f = font(FONT_BOLD if bold else FONT_REG, size)
    if max_w:
        s = "\n".join(wrap(draw, s, f, max_w))
    draw.multiline_text(xy, s, font=f, fill=color, anchor=anchor, spacing=spacing, align=align)
    return draw.textbbox(xy, s, font=f, anchor=anchor, spacing=spacing, align=align)


def mono(draw, xy, s, size, color, bold=False, anchor="la"):
    if any(ord(ch) > 127 for ch in s):
        f = font(FONT_BOLD if bold else FONT_REG, size)
        draw.text(xy, s, font=f, fill=color, anchor=anchor)
        return
    f = font(FONT_MONO_B if bold else FONT_MONO, size)
    draw.text(xy, s, font=f, fill=color, anchor=anchor)


def rounded(draw, box, r, fill=None, outline=None, width=1):
    draw.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=width)


def make_background(deep=False):
    top = (3, 8, 14) if deep else (6, 15, 25)
    bottom = (8, 24, 39) if deep else (8, 26, 43)
    img = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(img)
    for y in range(H):
        k = y / (H - 1)
        # ease the gradient toward the bottom
        k = k * k * (3 - 2 * k)
        d.line((0, y, W, y), fill=tuple(int(lerp(top[i], bottom[i], k)) for i in range(3)))
    grid = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grid)
    for x in range(0, W, 80):
        gd.line((x, 0, x, H), fill=(120, 180, 220, 10), width=1)
    for y in range(0, H, 80):
        gd.line((0, y, W, y), fill=(120, 180, 220, 10), width=1)
    # sonar rings, static and very quiet
    for r in (260, 420, 600, 780):
        gd.ellipse((960 - r, 560 - r, 960 + r, 560 + r), outline=(87, 224, 192, 9), width=1)
    img = Image.alpha_composite(img.convert("RGBA"), grid)

    # vignette
    small = Image.new("L", (256, 144), 0)
    sd = ImageDraw.Draw(small)
    for i in range(70):
        a = int(120 * (i / 70) ** 2)
        sd.ellipse((128 - 120 + i, 72 - 70 + i, 128 + 120 - i, 72 + 70 - i), outline=a, width=2)
    vig = small.resize((W, H), Image.Resampling.BILINEAR).filter(ImageFilter.GaussianBlur(24))
    dark = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dark.putalpha(vig)
    img = Image.alpha_composite(img, dark)

    # scanlines + fine grain (static, cheap)
    scan = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(scan)
    for y in range(0, H, 4):
        sd.line((0, y, W, y), fill=(0, 0, 0, 12), width=1)
    img = Image.alpha_composite(img, scan)
    noise = Image.effect_noise((W, H), 9).convert("L")
    noise_rgba = Image.new("RGBA", (W, H), (255, 255, 255, 0))
    noise_rgba.putalpha(noise.point(lambda p: int(p * 0.05)))
    return Image.alpha_composite(img, noise_rgba)


BACKGROUND = None
BACKGROUND_DEEP = None


def whale(size, alpha=255):
    img = Image.open(BRAND / "pixel-whale-mark-1024.png").convert("RGBA")
    img = img.resize((size, size), Image.Resampling.NEAREST)
    if alpha < 255:
        a = img.getchannel("A").point(lambda p: int(p * alpha / 255))
        img.putalpha(a)
    return img


def paste_whale(base, cx, cy, size, alpha=255, glow=True):
    img = whale(size, alpha)
    x, y = int(cx - size / 2), int(cy - size / 2)
    if glow:
        halo = whale(int(size * 1.22), int(alpha * 0.22)).filter(ImageFilter.GaussianBlur(size * 0.05))
        base.alpha_composite(halo, (int(cx - halo.width / 2), int(cy - halo.height / 2)))
    base.alpha_composite(img, (x, y))


def rings(draw, cx, cy, t, color=CYAN, n=4, max_r=620, speed=70):
    for i in range(n):
        phase = (t * speed + i * (max_r / n)) % max_r
        a = int(70 * (1 - phase / max_r))
        draw.ellipse((cx - phase, cy - phase, cx + phase, cy + phase), outline=rgba(color, a), width=2)


def waveform(draw, x, y, w, h, t, color=CYAN, bars=28, alpha=255):
    for i in range(bars):
        k = i / max(1, bars - 1)
        amp = (0.28 + 0.72 * abs(math.sin(i * 0.77 + t * 5.2))) * (0.55 + 0.45 * math.sin(math.pi * k))
        bh = max(2, int(h * amp))
        bx = x + i * (w / bars)
        draw.rounded_rectangle((bx, y + (h - bh) / 2, bx + max(2, w / bars * 0.55), y + (h + bh) / 2), radius=2, fill=rgba(color, alpha))


def accent_line(draw, x, y, w, color=CYAN, alpha=255):
    draw.rounded_rectangle((x, y, x + w, y + 3), radius=2, fill=rgba(color, alpha))


def draw_orb(draw, cx, cy, r, t, style="ring", color=CYAN):
    if style == "ring":
        draw.ellipse((cx - r, cy - r, cx + r, cy + r), outline=rgba(color, 210), width=max(2, r // 12))
        draw.ellipse((cx - r * 0.55, cy - r * 0.55, cx + r * 0.55, cy + r * 0.55), outline=rgba(color, 90), width=2)
        draw.ellipse((cx - r * 0.12, cy - r * 0.12, cx + r * 0.12, cy + r * 0.12), fill=color)
    elif style == "pulse":
        for i in range(3):
            k = ((t * 0.55 + i / 3) % 1)
            rr = r * (0.35 + 0.65 * k)
            draw.ellipse((cx - rr, cy - rr, cx + rr, cy + rr), outline=rgba(color, int(120 * (1 - k))), width=2)
        draw.ellipse((cx - r * 0.3, cy - r * 0.3, cx + r * 0.3, cy + r * 0.3), fill=rgba(color, 230))
    elif style == "minimal":
        draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=rgba(color, 235))
        draw.ellipse((cx - r * 0.28, cy - r * 0.28, cx + r * 0.28, cy + r * 0.28), fill=INK)
    else:  # pixel
        size = int(r * 1.7)
        mark = whale(size, 255)
        base = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        base.alpha_composite(mark, (0, 0))
        # caller draws onto a draw object, so this branch is handled by paste_whale instead
        draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=rgba(color, 35), outline=rgba(color, 210), width=2)


def draw_phone(base, x, y, w, h, content, t):
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    rounded(sd, (x + 10, y + 26, x + w + 10, y + h + 26), 58, fill=(0, 0, 0, 150))
    base.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(26)))

    phone = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    pd = ImageDraw.Draw(phone)
    rounded(pd, (0, 0, w - 1, h - 1), 58, fill=(4, 9, 15, 255), outline=(43, 62, 80, 255), width=2)
    rounded(pd, (7, 7, w - 8, h - 8), 52, fill=(3, 7, 12, 255))
    sw, sh = w - 22, h - 22
    screen = Image.new("RGBA", (sw, sh), (10, 20, 32, 255))
    content(ImageDraw.Draw(screen), sw, sh, t)
    mask = Image.new("L", (sw, sh), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, sw - 1, sh - 1), radius=46, fill=255)
    screen.putalpha(mask)
    phone.alpha_composite(screen, (11, 11))
    base.alpha_composite(phone, (x, y))


def phone_top(d, sw, sh, t):
    d.rectangle((0, 0, sw, 58), fill=(12, 25, 39, 255))
    mono(d, (22, 20), "9:41", 13, MIST)
    mono(d, (sw - 32, 20), "···", 16, MUTED, anchor="ra")
    draw_text(d, (sw / 2, 20), "鲸语", 15, MIST, bold=True, anchor="ma")
    d.line((0, 58, sw, 58), fill=(28, 48, 66, 255), width=1)


def phone_composer(d, sw, sh, t, active=True, stopped=False):
    y = sh - 76
    rounded(d, (16, y, sw - 16, y + 52), 26, fill=(17, 33, 49, 255), outline=(38, 62, 84, 255), width=1)
    mono(d, (38, y + 16), "Ask WhaleGo", 13, (110, 139, 162, 255))
    col = CYAN if active else (95, 116, 134, 255)
    cx, cy = sw - 44, y + 26
    d.ellipse((cx - 16, cy - 16, cx + 16, cy + 16), fill=rgba(col, 235))
    if stopped:
        d.rectangle((cx - 5, cy - 5, cx + 5, cy + 5), fill=INK)
    else:
        d.ellipse((cx - 5, cy - 5, cx + 5, cy + 5), fill=INK)


def phone_message(d, x, y, w, text, progress=1.0, color=MIST, size=17, bold=False):
    f = font(FONT_BOLD if bold else FONT_REG, size)
    shown = text[: max(0, int(len(text) * clamp(progress)))]
    lines = wrap(d, shown, f, w)
    for i, line in enumerate(lines):
        d.text((x, y + i * (size + 9)), line, font=f, fill=color)
    return y + max(1, len(lines)) * (size + 9)


def voice_block(d, x, y, w, text, progress, active=True, label=True, stopped=False):
    color = CYAN if active else (95, 116, 134, 255)
    if label:
        mono(d, (x, y), "语音脑", 10, rgba(color, 210))
        y += 18
    d.rounded_rectangle((x, y + 2, x + 3, y + 76), radius=2, fill=rgba(color, 220))
    end = phone_message(d, x + 16, y, w - 16, text, progress, MIST, 17)
    if active:
        waveform(d, x + 16, end + 4, 86, 12, len(text) * 0.4 + progress * 8, color, 18, 190)
        end += 20
    if stopped:
        mono(d, (x + 16, end + 2), "已停止播报", 11, AMBER, anchor="la")
        end += 18
    return end + 8


def text_block(d, x, y, w, text, progress=1.0, alpha=255, label=True):
    color = AMBER
    if label:
        mono(d, (x, y), "文字脑 · 完整答案", 10, rgba(color, int(alpha * 0.9)))
        y += 18
    d.rounded_rectangle((x, y + 2, x + 3, y + 96), radius=2, fill=rgba(color, int(alpha * 0.9)))
    end = phone_message(d, x + 16, y, w - 16, text, progress, rgba(MIST, alpha), 16)
    return end + 8


# ---------------------------------------------------------------- scenes


def scene_open(t, frame):
    global BACKGROUND_DEEP
    d = ImageDraw.Draw(frame)
    rings(d, 960, 470, t, CYAN, 5, 760, 58)
    k = span(t, 0.2, 1.4)
    paste_whale(frame, 960, 430, int(300 + 20 * math.sin(t * 1.6)), int(255 * k))
    draw_text(d, (963, 703), "鲸语", 104, (0, 0, 0, 255), bold=True, anchor="mm")
    draw_text(d, (960, 700), "鲸语", 104, MIST, bold=True, anchor="mm")
    d.line((660, 836, 1260, 836), fill=rgba(CYAN, 80), width=1)
    mono(d, (960, 866), "W H A L E G O", 26, CYAN, anchor="ma")
    draw_text(d, (960, 922), "先听见，再见。", 32, MUTED, anchor="ma")


def scene_problem(t, frame):
    d = ImageDraw.Draw(frame)
    mono(d, (120, 108), "0 1  /  T H E   G A P", 18, CYAN)
    draw_text(d, (120, 148), "一句话说不清。", 62, MIST, bold=True)
    draw_text(d, (120, 232), "快的回答往往浅，好的回答往往慢。", 28, MUTED)

    # left card
    rounded(d, (120, 350, 860, 900), 28, fill=(11, 27, 43, 220), outline=(35, 58, 78, 255), width=1)
    mono(d, (156, 386), "只 说", 16, CYAN)
    draw_text(d, (156, 428), "即时，但浅", 40, MIST, bold=True)
    draw_text(d, (156, 492), "语音脑沿着时间往前走。\n一句话说完，就结束了。", 24, MUTED, spacing=12)
    waveform(d, 156, 700, 640, 96, t * 1.2, CYAN, 34, 220)
    mono(d, (156, 830), "线性 · 口语 · 听过就散", 14, rgba(CYAN, 180))

    # right card
    rounded(d, (1060, 350, 1800, 900), 28, fill=(15, 24, 31, 220), outline=(62, 54, 36, 255), width=1)
    mono(d, (1096, 386), "只 写", 16, AMBER)
    draw_text(d, (1096, 428), "完整，但慢", 40, MIST, bold=True)
    draw_text(d, (1096, 492), "文字脑要组织、要查证、要排版。\n答案很好，但要等。", 24, MUTED, spacing=12)
    # faux long answer
    for i in range(7):
        yy = 660 + i * 26
        ww = [560, 610, 520, 640, 470, 590, 360][i]
        d.rounded_rectangle((1096, yy, 1096 + ww, yy + 9), radius=4, fill=(84, 76, 58, 200))
    mono(d, (1096, 850), "结构化 · 可回看 · 要等待", 14, rgba(AMBER, 180))

    # center mark
    k = span(t, 2.0, 3.2)
    if k > 0:
        draw_text(d, (960, 300), "错过", 26, rgba(AMBER, int(200 * k)), bold=True, anchor="ma")
        d.line((960, 330, 960, 860), fill=rgba(AMBER, int(35 * k)), width=1)


def scene_dual(t, frame):
    d = ImageDraw.Draw(frame)
    mono(d, (120, 96), "0 2  /  T W O   B R A I N S", 18, CYAN)
    draw_text(d, (120, 136), "两个脑子，同时工作。", 58, MIST, bold=True)
    draw_text(d, (120, 214), "一个负责让你马上听见，一个负责把答案写对。", 27, MUTED)

    # paths first
    left = (380, 600)
    right = (1540, 600)
    box = (770, 330, 1150, 820)
    d.line((left[0] + 90, left[1], box[0] - 40, 470), fill=rgba(CYAN, 90), width=2)
    d.line((right[0] - 90, right[1], box[2] + 40, 470), fill=rgba(AMBER, 90), width=2)
    d.line((box[0] - 40, 700, left[0] + 90, 700), fill=rgba(CYAN, 35), width=1)
    d.line((box[2] + 40, 700, right[0] - 90, 700), fill=rgba(AMBER, 35), width=1)

    # nodes
    for cx, cy, color, label, sub in (
        (300, 600, CYAN, "语音脑", "先说"),
        (1620, 600, AMBER, "文字脑", "后写"),
    ):
        pulse = 1 + 0.04 * math.sin(t * 2.2)
        r = 74 * pulse
        d.ellipse((cx - r - 18, cy - r - 18, cx + r + 18, cy + r + 18), outline=rgba(color, 55), width=2)
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=mix(INK, color, 0.12), outline=rgba(color, 220), width=2)
        draw_text(d, (cx, cy - 16), label, 28, color, bold=True, anchor="ma")
        mono(d, (cx, cy + 24), sub, 14, rgba(color, 220), anchor="ma")

    # conversation panel
    rounded(d, box, 22, fill=(7, 17, 28, 244), outline=(40, 64, 86, 255), width=1)
    rounded(d, (box[0] + 1, box[1] + 1, box[2] - 1, box[1] + 48), 21, fill=(14, 28, 43, 255))
    draw_text(d, (box[0] + 22, box[1] + 14), "会话", 15, MIST, bold=True)
    mono(d, (box[2] - 24, box[1] + 16), "LIVE", 11, CYAN, anchor="ra")
    # voice line
    vp = span(t, 1.5, 3.2)
    vy = box[1] + 78
    d.rounded_rectangle((box[0] + 22, vy, box[0] + 25, vy + 110), radius=2, fill=rgba(CYAN, 200))
    mono(d, (box[0] + 38, vy), "语音脑", 10, CYAN)
    phone_message(d, box[0] + 38, vy + 20, 300, "我先说结论。", vp, MIST, 16)
    waveform(d, box[0] + 38, vy + 56, 100, 12, t * 4, CYAN, 18, 200)
    # text line
    tp = span(t, 3.0, 4.0)
    ty = box[1] + 244
    d.rounded_rectangle((box[0] + 22, ty, box[0] + 25, ty + 140), radius=2, fill=rgba(AMBER, 200))
    mono(d, (box[0] + 38, ty), "文字脑 · 完整答案", 10, AMBER)
    phone_message(d, box[0] + 38, ty + 20, 300, "结论、依据、表格，一次写全。", tp, MIST, 16)
    for i in range(3):
        d.rounded_rectangle((box[0] + 38, ty + 82 + i * 18, box[0] + 38 + [220, 250, 170][i], ty + 88 + i * 18), radius=3, fill=(80, 70, 52, int(160 * tp)))
    mono(d, (box[0] + 22, box[3] - 34), "同一会话 · 两条时间线", 12, MUTED)

    # moving dots
    for i in range(14):
        p = (t * 0.22 + i / 14) % 1
        x = lerp(left[0] + 90, box[0] - 40, p)
        y = lerp(left[1], 470, p)
        d.ellipse((x - 2, y - 2, x + 2, y + 2), fill=rgba(CYAN, int(180 * (1 - p))))


def simple_phone(d, sw, sh, t):
    phone_top(d, sw, sh, t)
    # user bubble
    bw = 250
    rounded(d, (sw - bw - 18, 76, sw - 18, 130), 18, fill=(35, 61, 86, 255))
    phone_message(d, sw - bw, 90, bw - 20, "今天适合做什么？", 1, MIST, 15)
    # voice
    vy = 156
    p1 = span(t, 22.4, 23.2)
    vy = voice_block(d, 20, vy, sw - 40, "我想想。", p1, p1 < 1.0)
    p2 = span(t, 23.5, 26.5)
    if p2 > 0:
        vy = voice_block(d, 20, vy + 8, sw - 40, "今天适合做一点轻的事，先把最重要的一件完成。", p2, p2 < 1.0)
    # text answer
    p3 = span(t, 27.0, 27.6)
    if p3 > 0:
        text_block(d, 20, vy + 12, sw - 40, "先把最重要的一件完成。", p3, int(255 * p3))
    if t >= 27.0:
        mono(d, (18, sh - 108), "语音脑在说 · 文字脑已落字", 10, MUTED)
    phone_composer(d, sw, sh, t, active=p2 < 1.0)
    mono(d, (sw - 20, sh - 18), "界面示意", 9, (90, 112, 132, 255), anchor="ra")


def complex_phone(d, sw, sh, t):
    phone_top(d, sw, sh, t)
    # user bubble
    bubble = "帮我查一下今年的模型排名，整理成表。"
    bw = 320
    rounded(d, (sw - bw - 16, 74, sw - 16, 146), 18, fill=(35, 61, 86, 255))
    phone_message(d, sw - bw, 88, bw - 22, bubble, 1, MIST, 15)

    vy = 172
    p1 = span(t, 32.8, 33.8)
    vy = voice_block(d, 18, vy, sw - 36, "行，我来查查。", p1, p1 < 1.0)
    p2 = span(t, 34.6, 40.2)
    voice_text = "截至十月，不同榜单差异很大，我先说结论。"
    if p2 > 0:
        vy = voice_block(d, 18, vy + 6, sw - 36, voice_text, p2, p2 < 1.0, stopped=t >= 45.0)

    # text answer is inserted whole, then pushed down by the growing voice line
    if t >= 36.4:
        full = "综合榜单里，模型 A 暂时领先；真实用户盲测里，模型 B 更靠前。"
        ty = vy + 14
        # when the answer would fall below the composer, scroll the block up
        max_y = sh - 190
        scroll = max(0, ty + 300 - max_y)
        ty -= scroll
        a = int(255 * span(t, 36.4, 37.0))
        text_block(d, 18, ty, sw - 36, full, 1.0, a)
        # table
        table_y = ty + 116
        if table_y < sh - 120:
            rounded(d, (18, table_y, sw - 18, min(sh - 90, table_y + 132)), 12, fill=(20, 33, 45, 255), outline=(55, 70, 82, 255), width=1)
            mono(d, (30, table_y + 10), "示例数据 · 综合指数", 9, MUTED)
            rows = [("模型 A", "72.6"), ("模型 B", "70.7"), ("模型 C", "69.9")]
            for i, (name, score) in enumerate(rows):
                yy = table_y + 34 + i * 25
                if yy + 20 > min(sh - 90, table_y + 132):
                    break
                mono(d, (30, yy), name, 11, MIST)
                mono(d, (sw - 30, yy), score, 11, AMBER, anchor="ra")
                d.line((30, yy + 18, sw - 30, yy + 18), fill=(40, 56, 70, 255), width=1)

    stopped = t >= 45.0
    phone_composer(d, sw, sh, t, active=not stopped, stopped=stopped)
    if stopped:
        mono(d, (18, sh - 104), "只停声音，答案还在", 10, AMBER)
    mono(d, (sw - 20, sh - 18), "界面示意", 9, (90, 112, 132, 255), anchor="ra")


def scene_simple(t, frame):
    d = ImageDraw.Draw(frame)
    mono(d, (120, 110), "0 3  /  S I M P L E", 18, CYAN)
    draw_text(d, (120, 150), "简单问题", 58, MIST, bold=True)
    draw_text(d, (120, 228), "先说，再落字。", 30, MUTED)
    draw_text(d, (120, 330), "语音脑先接住对话，\n文字脑把结论留在屏幕上。", 26, MIST, spacing=14)
    accent_line(d, 120, 470, 120, CYAN)
    mono(d, (120, 500), "不弹字幕 · 不弹幕 · 直接进会话", 15, rgba(CYAN, 210))
    draw_text(d, (120, 760), "“我先说，你随时可以打断。”", 26, MUTED)
    draw_phone(frame, 1240, 64, 480, 952, simple_phone, t)


def scene_complex(t, frame):
    d = ImageDraw.Draw(frame)
    mono(d, (100, 84), "0 4  /  C O M P L E X", 18, AMBER)
    draw_text(d, (100, 124), "复杂问题", 58, MIST, bold=True)
    draw_text(d, (100, 202), "语音先走，文字后到。", 30, MUTED)
    bullets = [
        ("语音脑照常播报，文字流式进入会话", CYAN),
        ("文字脑直接给出完整答案，不等语音", AMBER),
        ("语音变长，答案被自然往下挤", AMBER),
        ("打断只停声音，不丢答案", CYAN),
    ]
    y = 300
    for s, color in bullets:
        d.ellipse((100, y + 9, 108, y + 17), fill=color)
        draw_text(d, (124, y), s, 25, MIST)
        y += 58
    accent_line(d, 100, 560, 90, AMBER)
    mono(d, (100, 588), "同一会话 · 两种速度", 14, rgba(AMBER, 210))
    draw_text(d, (100, 690), "“我先说结论，\n表格在下面。”", 40, MIST, spacing=14)
    draw_phone(frame, 1290, 54, 480, 972, complex_phone, t)


def scene_native(t, frame):
    d = ImageDraw.Draw(frame)
    mono(d, (120, 100), "0 5  /  N A T I V E", 18, CYAN)
    draw_text(d, (120, 140), "球是原生的，风格是你选的。", 54, MIST, bold=True)
    draw_text(d, (120, 218), "插件只声明，Flutter 来画。所以它永远和 DSH-Go 长得一样。", 25, MUTED, max_w=1640)

    # orb gallery
    styles = [("ring", "环形"), ("pulse", "脉冲"), ("pixel", "像素"), ("minimal", "极简")]
    x0, y0, cw, ch = 120, 330, 300, 240
    for i, (style, label) in enumerate(styles):
        x = x0 + (i % 2) * 330
        y = y0 + (i // 2) * 270
        rounded(d, (x, y, x + cw, y + ch), 20, fill=(10, 25, 40, 230), outline=(36, 60, 80, 255), width=1)
        cx, cy = x + cw / 2, y + 96
        if style == "pixel":
            paste_whale(frame, cx, cy, 126, 255, glow=False)
        else:
            draw_orb(d, cx, cy, 52, t + i, style, CYAN if i != 3 else MIST)
        mono(d, (x + 18, y + ch - 38), label, 14, MUTED)
        if i == 0:
            mono(d, (x + cw - 18, y + ch - 38), "默认", 11, CYAN, anchor="ra")

    # settings card
    rounded(d, (900, 330, 1800, 900), 26, fill=(9, 23, 37, 235), outline=(38, 62, 84, 255), width=1)
    rounded(d, (900, 330, 1800, 386), 25, fill=(14, 30, 46, 255))
    draw_text(d, (930, 346), "鲸语 · 设置", 18, MIST, bold=True)
    mono(d, (1770, 350), "原生绘制", 11, CYAN, anchor="ra")
    rows = [
        ("悬浮球样式", "环形 / 脉冲 / 像素 / 极简"),
        ("语音脑", "声线 · 语速 · 思考垫音"),
        ("文字脑", "自动补全 · 会话内显示"),
        ("打断与缓存", "只停声音 · 本地音频缓存"),
    ]
    for i, (k, v) in enumerate(rows):
        yy = 420 + i * 108
        d.line((930, yy + 76, 1770, yy + 76), fill=(30, 50, 68, 255), width=1)
        draw_text(d, (930, yy), k, 22, MIST, bold=True)
        draw_text(d, (930, yy + 36), v, 18, MUTED)
        mono(d, (1770, yy + 8), "›", 24, MUTED, anchor="ra")
    mono(d, (930, 862), "设置只在 App 设置页 · 不在球下", 13, rgba(CYAN, 200))


def scene_brand(t, frame):
    d = ImageDraw.Draw(frame)
    rings(d, 1420, 520, t, CYAN, 5, 700, 45)
    # whale swims in
    k = span(t, 0.2, 3.0)
    wx = lerp(260, 1260, k)
    paste_whale(frame, wx, 470 + 12 * math.sin(t * 1.4), 380, 255)
    # bubbles
    for i in range(16):
        bx = 300 + (i * 97) % 1100
        by = 780 - ((t * 26 + i * 53) % 380)
        r = 2 + (i % 4)
        d.ellipse((bx - r, by - r, bx + r, by + r), outline=rgba(CYAN, 90), width=1)
    mono(d, (120, 100), "0 6  /  W H Y   W H A L E", 18, CYAN)
    draw_text(d, (120, 148), "鲸鱼用声呐辨认方向，\n用鲸歌交换消息。", 48, MIST, bold=True, spacing=14)
    lines = [
        ("声呐", "听", CYAN),
        ("鲸歌", "说", CYAN),
        ("Whale", "DeepSeek 的意象", WHALE_HI),
        ("Go", "DSH-Go", WHALE_HI),
    ]
    y = 430
    for i, (a, b, color) in enumerate(lines):
        kk = span(t, 1.0 + i * 0.7, 1.6 + i * 0.7)
        if kk <= 0:
            continue
        d.rounded_rectangle((120, y, 130, y + 44), radius=4, fill=rgba(color, int(200 * kk)))
        draw_text(d, (150, y - 2), a, 30, rgba(MIST, int(255 * kk)), bold=True)
        draw_text(d, (310, y + 4), b, 22, rgba(MUTED, int(255 * kk)))
        y += 84
    mono(d, (120, 862), "WHALEGO · A VOICE PLUGIN FOR DSH-GO", 14, rgba(CYAN, 190))


def scene_end(t, frame):
    d = ImageDraw.Draw(frame)
    rings(d, 520, 540, t, CYAN, 4, 500, 40)
    paste_whale(frame, 520, 540 + 8 * math.sin(t * 1.4), 440, 255)
    rounded(d, (880, 250, 1770, 790), 26, fill=(5, 13, 22, 255), outline=(31, 53, 72, 255), width=1)
    draw_text(d, (900, 300), "鲸语", 92, MIST, bold=True)
    mono(d, (908, 420), "W H A L E G O", 24, CYAN)
    draw_text(d, (900, 500), "先听见，再见。", 34, MUTED)
    accent_line(d, 900, 570, 160, CYAN)
    draw_text(d, (900, 610), "DSH-Go 双脑语音插件", 22, MIST)
    mono(d, (900, 680), "MIT · github.com/JumpTea/WhaleGo", 15, rgba(CYAN, 230))
    draw_text(d, (900, 736), "无字幕 · 无弹幕 · 原生悬浮球", 16, MUTED)


SCENES = [
    (0.0, scene_open),
    (5.0, scene_problem),
    (13.0, scene_dual),
    (22.0, scene_simple),
    (31.0, scene_complex),
    (48.0, scene_native),
    (58.0, scene_brand),
    (68.0, scene_end),
]
CUTS = [5.0, 13.0, 22.0, 31.0, 48.0, 58.0, 68.0]


def render_frame(t: float):
    frame = (BACKGROUND_DEEP if t >= 58 else BACKGROUND).copy()
    scene = SCENES[0][1]
    for start, fn in SCENES:
        if t >= start:
            scene = fn
    scene(t, frame)

    # cut to black at scene boundaries, plus opening fade
    black = 0.0
    if t < 1.0:
        black = max(black, 1 - smooth(t / 1.0))
    for b in CUTS:
        if 0 <= b - t < 0.32:
            black = max(black, 1 - smooth((b - t) / 0.32))
        elif 0 <= t - b < 0.32:
            black = max(black, 1 - smooth((t - b) / 0.32))
    if t > DUR - 1.2:
        black = max(black, smooth((t - (DUR - 1.2)) / 1.2))
    if black > 0:
        frame = Image.alpha_composite(frame, Image.new("RGBA", (W, H), (0, 0, 0, int(255 * black))))
    return frame.convert("RGB")


def stills():
    STILLS.mkdir(parents=True, exist_ok=True)
    for sec in (2.5, 8.0, 16.0, 25.0, 38.5, 46.0, 52.0, 62.0, 71.0):
        render_frame(sec).save(STILLS / f"still-{sec:05.1f}.png")
        print("still", sec)


def render_video():
    FRAMES.mkdir(parents=True, exist_ok=True)
    video = PROMO / "whalego-promo-video.mp4"
    cmd = [
        _FFMPEG,
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgb24",
        "-s",
        f"{W}x{H}",
        "-r",
        str(FPS),
        "-i",
        "-",
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "18",
        "-pix_fmt",
        "yuv420p",
        str(video),
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    try:
        for i in range(TOTAL):
            t = i / FPS
            frame = render_frame(t)
            proc.stdin.write(frame.tobytes())
            if i % 150 == 0:
                print(f"frame {i}/{TOTAL} ({t:.1f}s)", flush=True)
    finally:
        proc.stdin.close()
        proc.wait()
    print("video", video, video.stat().st_size)


if __name__ == "__main__":
    BACKGROUND = make_background(False)
    BACKGROUND_DEEP = make_background(True)
    if "--full" in sys.argv:
        render_video()
    else:
        stills()
