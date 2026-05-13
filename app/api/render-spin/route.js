import ffmpegPath from "ffmpeg-static";
import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { NextResponse } from "next/server";

import { buildSpinManifest } from "../../../web/lib/spin.mjs";
import { hasRemoveBgKey, removeBackgroundWithRemoveBg } from "../../../web/lib/background-removal.mjs";
import {
  buildSupabasePublicUrl,
  buildSupabaseRenderObjectPath,
  getSupabaseStorageConfig,
  uploadBufferToSupabaseStorage
} from "../../../web/lib/supabase-storage.mjs";

export const runtime = "nodejs";
export const maxDuration = 300;

const execFileAsync = promisify(execFile);
const MAX_SPIN_FRAMES = 72;

async function downloadVideo(videoUrl, outputPath) {
  const response = await fetch(videoUrl);
  if (!response.ok) {
    throw new Error(`Download video fallito: ${response.status}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(outputPath, bytes);
}

export async function POST(request) {
  let renderDir;
  try {
    const { videoUrl, backgroundColor = "0xf2f2f2" } = await request.json();
    if (!videoUrl || !/^https?:\/\//.test(videoUrl)) {
      return NextResponse.json({ error: "videoUrl non valido." }, { status: 400 });
    }

    const config = getSupabaseStorageConfig();
    const id = `spin-${Date.now()}-${randomUUID()}`;
    renderDir = join(tmpdir(), "tredifits-renders", id);
    const framesDir = join(renderDir, "frames");
    const inputPath = join(renderDir, "source.mp4");
    await mkdir(framesDir, { recursive: true });
    await downloadVideo(videoUrl, inputPath);

    const outputPattern = join(framesDir, "frame_%05d.png");
    const semanticMatting = hasRemoveBgKey();
    const baseFilters = [
      `fps=24`,
      `select='not(mod(n\\,2))'`,
      "scale='min(900,iw)':-1:flags=lanczos"
    ];
    const filter = [
      ...baseFilters,
      ...(semanticMatting ? [] : [`colorkey=${backgroundColor}:0.28:0.16`]),
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
    for (let i = 0; i < frameNames.length; i += 8) {
      const batch = frameNames.slice(i, i + 8);
      const uploaded = await Promise.all(
        batch.map(async (frameName) => {
          const path = buildSupabaseRenderObjectPath({ renderId: id, fileName: frameName });
          const sourceBytes = await readFile(join(framesDir, frameName));
          const outputBytes = semanticMatting
            ? await removeBackgroundWithRemoveBg({ bytes: sourceBytes, fileName })
            : sourceBytes;
          await uploadBufferToSupabaseStorage({
            bytes: outputBytes,
            path,
            contentType: "image/png",
            config
          });
          return buildSupabasePublicUrl({ url: config.url, bucket: config.bucket, path });
        })
      );
      frameUrls.push(...uploaded);
    }

    const manifest = {
      ...buildSpinManifest({ id, prefix: "frame_", frameCount: frameUrls.length, ext: "png" }),
      frames: frameUrls
    };
    const manifestPath = buildSupabaseRenderObjectPath({ renderId: id, fileName: "manifest.json" });
    await uploadBufferToSupabaseStorage({
      bytes: Buffer.from(JSON.stringify(manifest, null, 2)),
      path: manifestPath,
      contentType: "application/json",
      config
    });

    return NextResponse.json({
      ...manifest,
      manifestUrl: buildSupabasePublicUrl({ url: config.url, bucket: config.bucket, path: manifestPath })
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Render spin fallito." }, { status: 500 });
  } finally {
    if (renderDir) {
      await rm(renderDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
