import { randomUUID } from "node:crypto";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { isReplicateModel, REPLICATE_MODELS } from "./replicate-models.mjs";

export const REPLICATE_API_BASE = "https://api.replicate.com/v1";

export { isReplicateModel, REPLICATE_MODELS };

export function encodeReplicateId(predictionId) {
  return `replicate-${predictionId}`;
}

export function decodeReplicateId(taskId) {
  if (!taskId.startsWith("replicate-")) throw new Error("Task Replicate non valido.");
  return taskId.slice("replicate-".length);
}

function normalizeAspect(aspectRatio, allowAdaptive = false) {
  if (allowAdaptive && aspectRatio === "adaptive") return "adaptive";
  if (aspectRatio === "9:16") return "9:16";
  return "16:9";
}

function normalizeGen4Duration(duration) {
  const n = Number(duration);
  return n === 10 ? 10 : 5;
}

function normalizeSeedanceDuration(duration) {
  const n = Number(duration);
  if (n === -1) return -1;
  if (!Number.isFinite(n)) return 5;
  return Math.min(12, Math.max(3, Math.round(n)));
}

function normalizeSeedanceResolution(quality) {
  if (quality === "480p") return "480p";
  return "720p";
}

function buildGen4TurboInput({ imageUrls, videoUrls, prompt, duration, aspectRatio }) {
  if (videoUrls.length > 0) throw new Error("Runway Gen-4 Turbo accetta solo immagine reference.");
  if (imageUrls.length === 0) throw new Error("Runway Gen-4 Turbo richiede una immagine reference.");
  return {
    image: imageUrls[0],
    prompt: prompt || "",
    duration: normalizeGen4Duration(duration),
    aspect_ratio: normalizeAspect(aspectRatio)
  };
}

function buildSeedance20Input({ imageUrls, videoUrls, prompt, duration, aspectRatio, quality }) {
  const input = {
    prompt: prompt || "",
    duration: normalizeSeedanceDuration(duration),
    resolution: normalizeSeedanceResolution(quality),
    aspect_ratio: normalizeAspect(aspectRatio, true),
    generate_audio: false
  };
  if (videoUrls.length > 0) {
    input.reference_videos = videoUrls.slice(0, 3);
    return input;
  }
  if (imageUrls.length === 1) {
    input.image = imageUrls[0];
    input.last_frame_image = imageUrls[0];
    return input;
  }
  if (imageUrls.length === 2) {
    input.image = imageUrls[0];
    input.last_frame_image = imageUrls[1];
    return input;
  }
  if (imageUrls.length > 2) {
    input.reference_images = imageUrls.slice(0, 9);
    return input;
  }
  throw new Error("Seedance 2.0 richiede almeno una immagine o un video reference.");
}

function buildReplicateInput(model, opts) {
  if (model === "runwayml/gen4-turbo") return buildGen4TurboInput(opts);
  if (model === "bytedance/seedance-2.0") return buildSeedance20Input(opts);
  throw new Error("Modello Replicate non gestito.");
}

export async function createReplicateTask(apiKey, { model, imageUrls = [], videoUrls = [], prompt, duration, aspectRatio, quality }) {
  if (!isReplicateModel(model)) throw new Error("Modello Replicate non supportato.");
  const input = buildReplicateInput(model, { imageUrls, videoUrls, prompt, duration, aspectRatio, quality });

  const response = await fetch(`${REPLICATE_API_BASE}/models/${model}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ input })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.detail || body?.error || `Replicate request failed with ${response.status}`);
  }
  return {
    id: encodeReplicateId(body.id),
    provider: "replicate",
    model,
    status: "running",
    progress: 0,
    predictionId: body.id
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

async function downloadReplicateVideo({ videoUrl, taskId }) {
  const id = `replicate-${taskId.slice("replicate-".length)}-${randomUUID()}`;
  const renderDir = join(process.cwd(), "public", "local-renders", id);
  const videoPath = join(renderDir, "video.mp4");
  await mkdir(renderDir, { recursive: true });
  if (!(await fileExists(videoPath))) {
    const response = await fetch(videoUrl);
    if (!response.ok) throw new Error(`Download video Replicate fallito: ${response.status}`);
    await writeFile(videoPath, Buffer.from(await response.arrayBuffer()));
  }
  return `/local-renders/${id}/video.mp4`;
}

function mapReplicateStatus(status) {
  if (status === "succeeded") return "completed";
  if (status === "failed" || status === "canceled") return "failed";
  return "running";
}

export async function getReplicateTask(apiKey, taskId) {
  const predictionId = decodeReplicateId(taskId);
  const response = await fetch(`${REPLICATE_API_BASE}/predictions/${predictionId}`, {
    headers: { Authorization: `Bearer ${apiKey}` }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.detail || body?.error || `Replicate operation failed with ${response.status}`);
  }

  const mapped = mapReplicateStatus(body.status);
  if (mapped === "failed") {
    return { id: taskId, provider: "replicate", status: "failed", progress: 100, error: { message: body.error || "Predizione fallita." } };
  }
  if (mapped === "running") {
    return { id: taskId, provider: "replicate", status: "running", progress: 0 };
  }

  const output = body.output;
  const videoUrl = Array.isArray(output) ? output[0] : output;
  if (!videoUrl) throw new Error("Replicate non ha restituito un video.");
  const publicVideoUrl = await downloadReplicateVideo({ videoUrl, taskId });
  return { id: taskId, provider: "replicate", status: "completed", progress: 100, results: [publicVideoUrl] };
}
