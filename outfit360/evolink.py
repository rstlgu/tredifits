from __future__ import annotations

import argparse
import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


API_BASE = "https://api.evolink.ai"
MODEL = "seedance-2.0-reference-to-video"


def default_seedance_prompt() -> str:
    return (
        "Create a realistic full body fashion video where the same person in the same outfit "
        "rotates smoothly 360 degree in place. Use the reference video and images to preserve "
        "the real clothing, back details, shoes, face, hair, and body proportions. Fixed camera, "
        "centered subject, clean neutral background, no extra people, no outfit changes."
    )


def build_generation_payload(
    image_urls: list[str] | None = None,
    video_urls: list[str] | None = None,
    prompt: str | None = None,
    duration: int = 5,
    quality: str = "720p",
    aspect_ratio: str = "adaptive",
    generate_audio: bool = False,
    callback_url: str | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "model": MODEL,
        "prompt": prompt or default_seedance_prompt(),
        "duration": duration,
        "quality": quality,
        "aspect_ratio": aspect_ratio,
        "generate_audio": generate_audio,
    }
    if image_urls:
        payload["image_urls"] = image_urls
    if video_urls:
        payload["video_urls"] = video_urls
    if callback_url:
        payload["callback_url"] = callback_url
    return payload


def request_json(method: str, path: str, api_key: str, body: dict[str, Any] | None = None) -> dict[str, Any]:
    data = json.dumps(body).encode("utf-8") if body is not None else None
    request = urllib.request.Request(
        f"{API_BASE}{path}",
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8")
        raise SystemExit(f"EvoLink API error {error.code}: {detail}") from error


def create_generation(api_key: str, payload: dict[str, Any]) -> dict[str, Any]:
    if not payload.get("image_urls") and not payload.get("video_urls"):
        raise SystemExit("EvoLink requires at least one image URL or video URL.")
    return request_json("POST", "/v1/videos/generations", api_key, payload)


def get_task(api_key: str, task_id: str) -> dict[str, Any]:
    return request_json("GET", f"/v1/tasks/{task_id}", api_key)


def wait_for_task(api_key: str, task_id: str, interval: int = 10, timeout: int = 900) -> dict[str, Any]:
    deadline = time.time() + timeout
    while time.time() < deadline:
        task = get_task(api_key, task_id)
        status = task.get("status")
        if status in {"completed", "failed"}:
            return task
        time.sleep(interval)
    raise SystemExit(f"Timed out waiting for EvoLink task: {task_id}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a 360 outfit rotation with EvoLink Seedance 2.0.")
    parser.add_argument("--image-url", action="append", default=[])
    parser.add_argument("--video-url", action="append", default=[])
    parser.add_argument("--prompt", default=None)
    parser.add_argument("--duration", type=int, default=5)
    parser.add_argument("--quality", default="720p", choices=["480p", "720p", "1080p"])
    parser.add_argument("--aspect-ratio", default="adaptive")
    parser.add_argument("--callback-url", default=None)
    parser.add_argument("--wait", action="store_true")
    parser.add_argument("--out-json", type=Path, default=Path("output/evolink-result.json"))
    args = parser.parse_args()

    api_key = os.environ.get("EVOLINK_API_KEY")
    if not api_key:
        raise SystemExit("Missing EVOLINK_API_KEY.")

    payload = build_generation_payload(
        image_urls=args.image_url,
        video_urls=args.video_url,
        prompt=args.prompt,
        duration=args.duration,
        quality=args.quality,
        aspect_ratio=args.aspect_ratio,
        callback_url=args.callback_url,
    )
    result = create_generation(api_key, payload)
    if args.wait:
        result = wait_for_task(api_key, result["id"])

    args.out_json.parent.mkdir(parents=True, exist_ok=True)
    args.out_json.write_text(json.dumps(result, indent=2))
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
