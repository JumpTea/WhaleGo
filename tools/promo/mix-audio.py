#!/usr/bin/env python3
"""Mix the promo soundtrack: one BGM bed + scheduled voice lines."""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PROMO = ROOT / "assets" / "promo"
VOICE = PROMO / "voice"
BGM = PROMO / "bgm.mp3"
BGM_SRC = Path(os.environ["BGM_SRC"]) if os.environ.get("BGM_SRC") else None
OUT = PROMO / "whalego-promo-audio.wav"
FFMPEG = os.environ.get("FFMPEG") or shutil.which("ffmpeg") or "ffmpeg"

# Voice cues are placed in the same time base as the picture.
VOICE_CUES = [
    ("01-problem", 1_000),
    ("02-tradeoff", 5_600),
    ("03-dual", 13_500),
    ("d1-think", 22_900),
    ("d3-simple", 24_900),
    ("04-stream", 36_400),
    ("d2-check", 33_200),
    ("05-interrupt", 44_400),
    ("06-native", 49_200),
    ("07-whale", 58_400),
    ("08-deepseek", 63_400),
    ("09-tagline", 68_400),
    ("10-end", 71_000),
]


def main() -> int:
    if BGM_SRC is not None:
        if not BGM_SRC.exists():
            print(f"missing BGM: {BGM_SRC}", file=sys.stderr)
            return 2
        shutil.copy2(BGM_SRC, BGM)
    if not BGM.exists():
        print(f"missing BGM: {BGM}", file=sys.stderr)
        return 2

    inputs = ["-i", str(BGM)]
    for name, _ in VOICE_CUES:
        inputs += ["-i", str(VOICE / f"{name}.mp3")]

    parts = [
        "[0:a]atrim=0:75,asetpts=PTS-STARTPTS,volume=0.55,"
        "afade=t=in:st=0:d=2,afade=t=out:st=71:d=4[bg]"
    ]
    voice_labels = []
    for i, (name, delay) in enumerate(VOICE_CUES, start=1):
        parts.append(
            f"[{i}:a]adelay={delay}:all=1,volume=1.30,"
            + "aformat=sample_rates=48000:channel_layouts=stereo[v%d]" % i
        )
        voice_labels.append(f"[v{i}]")
    parts.append("".join(voice_labels) + f"amix=inputs={len(voice_labels)}:normalize=0[vo]")
    parts.append("[bg][vo]sidechaincompress=threshold=0.03:ratio=4:attack=20:release=450:makeup=1[bgd]")
    parts.append(
        "[bgd][vo]amix=inputs=2:normalize=0,"
        + "alimiter=limit=0.95,loudnorm=I=-14:TP=-1.5:LRA=11[a]"
    )

    cmd = [
        FFMPEG,
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        *inputs,
        "-filter_complex",
        ";".join(parts),
        "-map",
        "[a]",
        "-t",
        "75",
        "-ar",
        "48000",
        "-ac",
        "2",
        str(OUT),
    ]
    print("mixing", OUT)
    subprocess.run(cmd, check=True)
    print("wrote", OUT, OUT.stat().st_size)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
