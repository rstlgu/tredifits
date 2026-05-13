import { NextResponse } from "next/server";

import { buildSeedancePayload, createEvolinkTask } from "../../../web/lib/evolink.mjs";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const apiKey = process.env.EVOLINK_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "EVOLINK_API_KEY non configurata sul server." }, { status: 500 });
    }

    const body = await request.json();
    const imageUrls = Array.isArray(body.imageUrls) ? body.imageUrls.filter(Boolean) : [];
    const videoUrls = Array.isArray(body.videoUrls) ? body.videoUrls.filter(Boolean) : [];

    if (imageUrls.length === 0 && videoUrls.length === 0) {
      return NextResponse.json({ error: "Servono almeno una foto o un video reference." }, { status: 400 });
    }

    const payload = buildSeedancePayload({
      imageUrls,
      videoUrls,
      prompt: body.prompt,
      duration: Number.isFinite(Number(body.duration)) ? Number(body.duration) : 5,
      quality: body.quality || "720p",
      aspectRatio: body.aspectRatio || "adaptive"
    });

    const task = await createEvolinkTask(apiKey, payload);
    return NextResponse.json(task);
  } catch (error) {
    return NextResponse.json({ error: error.message || "Generazione fallita." }, { status: 400 });
  }
}
