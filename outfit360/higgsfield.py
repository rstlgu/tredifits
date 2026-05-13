from __future__ import annotations

import argparse
import json
import shutil
import subprocess
from pathlib import Path


def default_rotation_prompt() -> str:
    return (
        "Full body fashion subject performs a smooth 360 degree rotation in place. "
        "Keep the same person, same outfit, same shoes, same proportions, and same pose. "
        "Camera locked, centered subject, clean transparent background, no scene, no extra people."
    )


def build_higgsfield_command(
    start_image: Path,
    prompt: str,
    model: str = "kling3_0",
    duration: int = 5,
) -> list[str]:
    return [
        "higgsfield",
        "generate",
        "create",
        model,
        "--prompt",
        prompt,
        "--start-image",
        str(start_image),
        "--duration",
        str(duration),
        "--sound",
        "off",
        "--wait",
        "--json",
    ]


def require_higgsfield_cli() -> None:
    if not shutil.which("higgsfield"):
        raise SystemExit(
            "Missing dependency: install Higgsfield CLI with `npm install -g @higgsfield/cli`, "
            "then run `higgsfield auth login`."
        )


def generate_rotation_video(
    start_image: Path,
    output_json: Path,
    prompt: str | None = None,
    model: str = "kling3_0",
    duration: int = 5,
) -> None:
    require_higgsfield_cli()
    output_json.parent.mkdir(parents=True, exist_ok=True)
    command = build_higgsfield_command(start_image, prompt or default_rotation_prompt(), model, duration)
    result = subprocess.run(command, check=True, capture_output=True, text=True)

    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError:
        payload = {"raw_output": result.stdout}

    output_json.write_text(json.dumps(payload, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a 360 rotation video with Higgsfield CLI.")
    parser.add_argument("start_image", type=Path)
    parser.add_argument("--out-json", type=Path, default=Path("output/higgsfield-result.json"))
    parser.add_argument("--model", default="kling3_0")
    parser.add_argument("--duration", type=int, default=5)
    parser.add_argument("--prompt", default=None)
    args = parser.parse_args()

    generate_rotation_video(
        start_image=args.start_image,
        output_json=args.out_json,
        prompt=args.prompt,
        model=args.model,
        duration=args.duration,
    )


if __name__ == "__main__":
    main()
