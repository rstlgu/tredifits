import { NextResponse } from "next/server";

import { buildSeedancePayload, createEvolinkTask } from "../../../web/lib/evolink.mjs";
import { createGeminiVeoTask, isGeminiVeoModel } from "../../../web/lib/gemini-veo.mjs";
import { createReplicateTask, isReplicateModel } from "../../../web/lib/replicate.mjs";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request) {
  try {
    const body = await request.json();
    const imageUrls = Array.isArray(body.imageUrls) ? body.imageUrls.filter(Boolean) : [];
    const videoUrls = Array.isArray(body.videoUrls) ? body.videoUrls.filter(Boolean) : [];

    if (imageUrls.length === 0 && videoUrls.length === 0) {
      return NextResponse.json({ error: "Servono almeno una foto o un video reference." }, { status: 400 });
    }

    if (isGeminiVeoModel(body.model)) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return NextResponse.json({ error: "GEMINI_API_KEY non configurata sul server." }, { status: 500 });
      }
      const task = await createGeminiVeoTask(apiKey, {
        model: body.model,
        imageUrls,
        videoUrls,
        prompt: body.prompt,
        quality: body.quality || "720p",
        aspectRatio: body.aspectRatio || "16:9"
      });
      return NextResponse.json(task);
    }

    if (isReplicateModel(body.model)) {
      const apiKey = process.env.REPLICATE_API_TOKEN;
      if (!apiKey) {
        return NextResponse.json({ error: "REPLICATE_API_TOKEN non configurato sul server." }, { status: 500 });
      }
      const task = await createReplicateTask(apiKey, {
        model: body.model,
        imageUrls,
        videoUrls,
        prompt: body.prompt,
        duration: Number.isFinite(Number(body.duration)) ? Number(body.duration) : 5,
        aspectRatio: body.aspectRatio || "16:9"
      });
      return NextResponse.json(task);
    }

    const apiKey = process.env.EVOLINK_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "EVOLINK_API_KEY non configurata sul server." }, { status: 500 });
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
    console.error("/api/generate error", error);
    return NextResponse.json({ error: error.message || "Generazione fallita." }, { status: 400 });
  }
}
