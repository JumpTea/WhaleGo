#!/usr/bin/env python3
"""Mix the 48 s WhaleGo promo audio: scheduled voice-over + ducked BGM.

Inputs live in film/public/audio. The voice schedule mirrors VOICE_CUES in
film/src/Promo.tsx. Output is a 48 kHz stereo WAV ready for muxing.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
AUDIO = ROOT / "film" / "public" / "audio"
OUT = ROOT / "film" / "out" / "whalego-promo-48s-audio.wav"

CUES: list[tuple[str, float]] = [
    ("v00-brand", 0.3),
    ("v01-problem", 2.2),
    ("v02-dual", 5.1),
    ("v03-voice", 8.3),
    ("u01-ask", 11.2),
    ("d01-check", 15.4),
    ("v05-stop", 18.2),
    ("u02-turn", 20.5),
    ("v06-native", 23.2),
    ("v07-orb", 27.4),
    ("v08-thread", 31.2),
    ("v09-device", 35.4),
    ("v10-tagline", 39.6),
    ("v11-end", 43.4),
]
BGM = "bgm"
DURATION = 48.0


def find_ffmpeg() -> str:
    if os.environ.get("FFMPEG"):
        return os.environ["FFMPEG"]
    found = shutil.which("ffmpeg")
    if found:
        return found
    try:
        import imageio_ffmpeg  # type: ignore

        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        pass
    fallback = Path.home() / "AppData/Roaming/Python/Python314/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe"
    if fallback.exists():
        return str(fallback)
    raise SystemExit("ffmpeg not found; set FFMPEG")


def main() -> int:
    ffmpeg = find_ffmpeg()
    inputs: list[Path] = []
    for name, _ in CUES:
        p = AUDIO / f"{name}.mp3"
        if not p.exists():
            raise SystemExit(f"missing voice clip: {p}")
        inputs.append(p)
    bgm = AUDIO / f"{BGM}.mp3"
    if not bgm.exists():
        raise SystemExit(f"missing BGM: {bgm}")
    inputs.append(bgm)

    args = [ffmpeg, "-y", "-hide_banner", "-loglevel", "error"]
    for p in inputs:
        args += ["-i", str(p)]

    filters: list[str] = []
    voice_labels: list[str] = []
    for i, (name, start) in enumerate(CUES):
        ms = int(round(start * 1000))
        label = f"v{i}"
        filters.append(
            f"[{i}:a]aformat=sample_rates=48000:channel_layouts=stereo,"
            f"volume=1.55,adelay={ms}|{ms}[{label}]"
        )
        voice_labels.append(f"[{label}]")

    filters.append(
        "".join(voice_labels)
        + f"amix=inputs={len(voice_labels)}:duration=longest:normalize=0[vo]"
    )
    filters.append("[vo]apad=whole_dur=48,atrim=0:48[vo48]")

    bi = len(CUES)
    filters.append(
        f"[{bi}:a]aformat=sample_rates=48000:channel_layouts=stereo,"
        f"volume=0.42,atrim=0:48,afade=t=in:st=0:d=1.2,"
        f"afade=t=out:st=45:d=3[bg]"
    )
    filters.append(
        "[bg][vo48]sidechaincompress=threshold=0.03:ratio=4:attack=20:"
        "release=450:makeup=1[bgd]"
    )
    filters.append(
        "[bgd][vo48]amix=inputs=2:duration=first:normalize=0,"
        "volume=2.0,acompressor=threshold=-20dB:ratio=3:attack=10:release=200:makeup=2.2,"
        "alimiter=0.94,loudnorm=I=-14:TP=-1.5:LRA=11[out]"
    )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    args += [
        "-filter_complex",
        ";".join(filters),
        "-map",
        "[out]",
        "-t",
        str(DURATION),
        "-ar",
        "48000",
        "-ac",
        "2",
        "-c:a",
        "pcm_s16le",
        str(OUT),
    ]
    print("ffmpeg:", ffmpeg)
    print("output:", OUT)
    proc = subprocess.run(args)
    if proc.returncode != 0:
        return proc.returncode
    if not OUT.exists():
        raise SystemExit("mix produced no output")
    print(f"ok: {OUT.stat().st_size:,} bytes")
    return 0


if __name__ == "__main__":
    sys.exit(main())

