import ffmpegPath from "ffmpeg-static";
import { randomUUID } from "node:crypto";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { NextResponse } from "next/server";

import { buildSpinManifest } from "../../../web/lib/spin.mjs";

export const runtime = "nodejs";
export const maxDuration = 120;

const execFileAsync = promisify(execFile);

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
    const { videoUrl, backgroundColor = "0x00ff00" } = await request.json();
    if (!videoUrl || !/^https?:\/\//.test(videoUrl)) {
      return NextResponse.json({ error: "videoUrl non valido." }, { status: 400 });
    }

    const id = `spin-${Date.now()}-${randomUUID()}`;
    const renderDir = join(process.cwd(), "public", "renders", id);
    const framesDir = join(renderDir, "frames");
    const inputPath = join(renderDir, "source.mp4");
    await mkdir(framesDir, { recursive: true });
    await downloadVideo(videoUrl, inputPath);

    const outputPattern = join(framesDir, "frame_%05d.webp");
    const filter = [
      "fps=32",
      `colorkey=${backgroundColor}:0.18:0.08`,
      "format=rgba"
    ].join(",");

    await execFileAsync(ffmpegPath, [
      "-y",
      "-i",
      inputPath,
      "-vf",
      filter,
      "-lossless",
      "1",
      "-compression_level",
      "4",
      outputPattern
    ]);

    const frameCount = (await readdir(framesDir)).filter((name) => name.endsWith(".webp")).length;
    const manifest = buildSpinManifest({ id, prefix: "frame_", frameCount, ext: "webp" });
    await writeFile(join(renderDir, "manifest.json"), JSON.stringify(manifest, null, 2));

    return NextResponse.json({
      ...manifest,
      manifestUrl: `/renders/${id}/manifest.json`
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Render spin fallito." }, { status: 500 });
  }
}
