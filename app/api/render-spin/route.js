import ffmpegPath from "ffmpeg-static";
import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { NextResponse } from "next/server";

import { buildSpinManifest } from "../../../web/lib/spin.mjs";
import { removeBackgroundInHouse } from "../../../web/lib/background-removal.mjs";

export const runtime = "nodejs";
export const maxDuration = 300;

const execFileAsync = promisify(execFile);
const MAX_SPIN_FRAMES = 48;

async function downloadVideo(videoUrl, outputPath) {
  const response = await fetch(videoUrl);
  if (!response.ok) {
    throw new Error(`Download video fallito: ${response.status}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(outputPath, bytes);
}

export async function POST(request) {
  try {
    const { videoUrl, backgroundColor = "0xf2f2f2" } = await request.json();
    if (!videoUrl || !/^https?:\/\//.test(videoUrl)) {
      return NextResponse.json({ error: "videoUrl non valido." }, { status: 400 });
    }

    const id = `spin-${Date.now()}-${randomUUID()}`;
    const renderDir = join(process.cwd(), "public", "local-renders", id);
    const framesDir = join(renderDir, "frames");
    const inputPath = join(renderDir, "source.mp4");
    await mkdir(framesDir, { recursive: true });
    await downloadVideo(videoUrl, inputPath);

    const outputPattern = join(framesDir, "frame_%05d.png");
    const baseFilters = [
      "fps=12",
      "scale='min(720,iw)':-1:flags=lanczos"
    ];
    const filter = [
      ...baseFilters,
      "format=rgba"
    ].join(",");

    await execFileAsync(ffmpegPath, [
      "-y",
      "-i",
      inputPath,
      "-vf",
      filter,
      "-compression_level",
      "6",
      outputPattern
    ]);

    const frameNames = (await readdir(framesDir)).filter((name) => name.endsWith(".png")).sort().slice(0, MAX_SPIN_FRAMES);
    const frameUrls = [];
    for (const frameName of frameNames) {
      const sourcePath = join(framesDir, frameName);
      const outputBytes = await removeBackgroundInHouse({ bytes: await readFile(sourcePath) });
      await writeFile(sourcePath, outputBytes);
      frameUrls.push(`/local-renders/${id}/frames/${frameName}`);
    }

    const manifest = {
      ...buildSpinManifest({ id, prefix: "frame_", frameCount: frameUrls.length, ext: "png" }),
      frames: frameUrls
    };
    await writeFile(join(renderDir, "manifest.json"), JSON.stringify(manifest, null, 2));

    return NextResponse.json({
      ...manifest,
      manifestUrl: `/local-renders/${id}/manifest.json`
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Render spin fallito." }, { status: 500 });
  }
}
