from __future__ import annotations

import argparse
import shutil
import subprocess
from pathlib import Path


def select_evenly_spaced(frames: list[Path], count: int) -> list[Path]:
    ordered = sorted(frames)
    if count <= 0 or not ordered:
        return []
    if count >= len(ordered):
        return ordered
    if count == 1:
        return [ordered[0]]

    last = len(ordered) - 1
    return [ordered[round(i * last / (count - 1))] for i in range(count)]


def build_frame_name(prefix: str, index: int, ext: str) -> str:
    clean_ext = ext.lower().lstrip(".") or "webp"
    return f"{prefix}{index:05d}.{clean_ext}"


def write_viewer(out_dir: Path, prefix: str, frame_count: int, ext: str) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    html = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Outfit 360 Viewer</title>
  <style>
    html, body {{ margin: 0; height: 100%; background: #f6f6f4; font-family: system-ui, sans-serif; }}
    main {{ height: 100%; display: grid; place-items: center; overflow: hidden; }}
    img {{ max-width: 92vw; max-height: 92vh; object-fit: contain; user-select: none; cursor: grab; }}
    img:active {{ cursor: grabbing; }}
  </style>
</head>
<body>
<main><img id="outfit" alt=""></main>
<script>
const FRAME_COUNT = {frame_count};
const PREFIX = '{prefix}';
const EXT = '{ext.lower().lstrip(".") or "webp"}';
let frame = 0;
let dragging = false;
let lastX = 0;
const img = document.getElementById('outfit');

function srcFor(index) {{
  const n = String((index % FRAME_COUNT + FRAME_COUNT) % FRAME_COUNT).padStart(5, '0');
  return `frames/${{PREFIX}}${{n}}.${{EXT}}`;
}}

function render() {{
  img.src = srcFor(frame);
}}

img.addEventListener('pointerdown', (event) => {{
  dragging = true;
  lastX = event.clientX;
  img.setPointerCapture(event.pointerId);
}});

img.addEventListener('pointermove', (event) => {{
  if (!dragging) return;
  const delta = event.clientX - lastX;
  if (Math.abs(delta) < 4) return;
  frame += delta > 0 ? 1 : -1;
  lastX = event.clientX;
  render();
}});

img.addEventListener('pointerup', () => dragging = false);
img.addEventListener('pointercancel', () => dragging = false);
render();
</script>
</body>
</html>
"""
    (out_dir / "index.html").write_text(html)


def require_binary(name: str) -> None:
    if not shutil.which(name):
        raise SystemExit(f"Missing dependency: install `{name}` and rerun.")


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True)


def build_sequence(video: Path, out_dir: Path, prefix: str, fps: int, frame_count: int, ext: str) -> None:
    require_binary("ffmpeg")
    require_binary("rembg")

    raw_dir = out_dir / "work" / "raw"
    cutout_dir = out_dir / "work" / "cutout"
    frames_dir = out_dir / "viewer" / "frames"
    raw_dir.mkdir(parents=True, exist_ok=True)
    cutout_dir.mkdir(parents=True, exist_ok=True)
    frames_dir.mkdir(parents=True, exist_ok=True)

    run(["ffmpeg", "-y", "-i", str(video), "-vf", f"fps={fps}", str(raw_dir / "%05d.png")])
    run(["rembg", "p", str(raw_dir), str(cutout_dir)])

    selected = select_evenly_spaced(list(cutout_dir.glob("*.png")), frame_count)
    for index, frame_path in enumerate(selected):
        output = frames_dir / build_frame_name(prefix, index, ext)
        run([
            "ffmpeg",
            "-y",
            "-i",
            str(frame_path),
            "-vf",
            "scale=900:-1:flags=lanczos",
            "-compression_level",
            "6",
            str(output),
        ])

    write_viewer(out_dir / "viewer", prefix=prefix, frame_count=len(selected), ext=ext)


def main() -> None:
    parser = argparse.ArgumentParser(description="Build a Yafa-style 360 frame sequence from a video.")
    parser.add_argument("video", type=Path)
    parser.add_argument("--out", type=Path, default=Path("output"))
    parser.add_argument("--prefix", default="outfit_001_")
    parser.add_argument("--fps", type=int, default=24)
    parser.add_argument("--frames", type=int, default=160)
    parser.add_argument("--ext", default="webp")
    args = parser.parse_args()

    build_sequence(args.video, args.out, args.prefix, args.fps, args.frames, args.ext)


if __name__ == "__main__":
    main()
