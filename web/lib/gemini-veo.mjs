import { randomUUID } from "node:crypto";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { isGeminiVeoModel, isVeo30Model, normalizeGeminiResolution, VEO_MODELS } from "./gemini-veo-models.mjs";

export const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

export { isGeminiVeoModel, isVeo30Model, normalizeGeminiResolution, VEO_MODELS };

export function encodeGeminiOperationId(operationName) {
  return `gemini-${Buffer.from(operationName).toString("base64url")}`;
}

export function decodeGeminiOperationId(taskId) {
  if (!taskId.startsWith("gemini-")) throw new Error("Task Gemini non valido.");
  return Buffer.from(taskId.slice("gemini-".length), "base64url").toString("utf8");
}

export function buildGeminiVeoPayload({
  model = "veo-3.1-fast-generate-preview",
  prompt,
  images = [],
  videoUrls = [],
  quality = "720p",
  aspectRatio = "16:9"
}) {
  if (!isGeminiVeoModel(model)) throw new Error("Modello Veo non supportato.");
  if (videoUrls.length > 0) throw new Error("Veo supporta reference immagini; i video reference non sono supportati in questa integrazione.");
  if (images.length === 0) throw new Error("Veo richiede almeno una reference immagine.");

  const parameters = {
    aspectRatio: aspectRatio === "9:16" ? "9:16" : "16:9",
    resolution: normalizeGeminiResolution(quality, model)
  };

  if (isVeo30Model(model)) {
    return {
      instances: [{
        prompt,
        image: { bytesBase64Encoded: images[0].data, mimeType: images[0].mimeType }
      }],
      parameters
    };
  }

  if (images.length > 3) throw new Error("Veo 3.1 supporta massimo 3 reference immagini.");
  return {
    instances: [{
      prompt,
      referenceImages: images.map((image) => ({
        image: { bytesBase64Encoded: image.data, mimeType: image.mimeType },
        referenceType: "asset"
      }))
    }],
    parameters
  };
}

async function fetchImageAsBase64(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download reference immagine fallito: ${response.status}`);
  const mimeType = response.headers.get("content-type")?.split(";")[0] || "image/png";
  if (!mimeType.startsWith("image/")) throw new Error(`Reference non immagine: ${mimeType}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  return { mimeType, data: bytes.toString("base64") };
}

export async function createGeminiVeoTask(apiKey, { model, imageUrls = [], videoUrls = [], prompt, quality, aspectRatio }) {
  const maxImages = isVeo30Model(model) ? 1 : 3;
  const images = await Promise.all(imageUrls.slice(0, maxImages).map(fetchImageAsBase64));
  const payload = buildGeminiVeoPayload({ model, prompt, images, videoUrls, quality, aspectRatio });
  const response = await fetch(`${GEMINI_API_BASE}/models/${model}:predictLongRunning`, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.error?.message || `Gemini Veo request failed with ${response.status}`);
  }
  return {
    id: encodeGeminiOperationId(body.name),
    provider: "gemini-veo",
    model,
    status: "running",
    progress: 0,
    operationName: body.name
  };
}

async function fileExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function downloadGeminiVideo({ apiKey, videoUri, taskId }) {
  const id = `gemini-${taskId.slice("gemini-".length)}-${randomUUID()}`;
  const renderDir = join(process.cwd(), "public", "local-renders", id);
  const videoPath = join(renderDir, "video.mp4");
  await mkdir(renderDir, { recursive: true });
  if (!(await fileExists(videoPath))) {
    const response = await fetch(videoUri, { headers: { "x-goog-api-key": apiKey } });
    if (!response.ok) throw new Error(`Download video Gemini fallito: ${response.status}`);
    await writeFile(videoPath, Buffer.from(await response.arrayBuffer()));
  }
  return `/local-renders/${id}/video.mp4`;
}

export async function getGeminiVeoTask(apiKey, taskId) {
  const operationName = decodeGeminiOperationId(taskId);
  const response = await fetch(`${GEMINI_API_BASE}/${operationName}`, {
    headers: { "x-goog-api-key": apiKey }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.error?.message || `Gemini operation failed with ${response.status}`);
  }
  if (body.error) {
    return { id: taskId, provider: "gemini-veo", status: "failed", progress: 100, error: body.error };
  }
  if (!body.done) {
    return { id: taskId, provider: "gemini-veo", status: "running", progress: 0 };
  }

  const videoUri = body.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
  if (!videoUri) throw new Error("Gemini Veo non ha restituito un video.");
  const publicVideoUrl = await downloadGeminiVideo({ apiKey, videoUri, taskId });
  return { id: taskId, provider: "gemini-veo", status: "completed", progress: 100, results: [publicVideoUrl] };
}
