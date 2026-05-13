export const EVOLINK_API_BASE = "https://api.evolink.ai";
export const SEEDANCE_MODEL = "seedance-2.0-reference-to-video";

export function defaultPrompt() {
  return "Create a hyper-realistic 5-second fashion video using all reference images and videos. The subject must remain perfectly still in the exact same pose during the entire clip, while only the camera rotates smoothly 360° around the person. Absolute fidelity to the main subject: preserve exactly the same face, hairstyle, body proportions, skin tone, outfit, fabric texture, stitching, accessories, shoes, and all front/back clothing details visible in the references. Solid plain background only (single-color studio backdrop, seamless and uniform), with no environment changes, props, reflections, or additional elements. Full-body centered framing, fixed distance, clean studio lighting, no distortion, no animation of clothing or body, no pose changes, no outfit changes, no extra people. Maintain realistic fabric behavior and accurate garment structure from every angle. Ultra-consistent identity and outfit continuity across all frames.";
}

export function validateReferences({ imageUrls = [], videoUrls = [] }) {
  if (imageUrls.length > 0 && videoUrls.length > 0) {
    throw new Error("Scegli foto oppure video, non entrambi.");
  }
  if (imageUrls.length > 2) {
    throw new Error("Puoi usare massimo 2 foto.");
  }
  if (videoUrls.length > 1) {
    throw new Error("Puoi usare massimo 1 video.");
  }
  if (imageUrls.length === 0 && videoUrls.length === 0) {
    throw new Error("Servono 1-2 foto oppure 1 video.");
  }
}

export function buildSeedancePayload({
  imageUrls = [],
  videoUrls = [],
  prompt = defaultPrompt(),
  duration = 5,
  quality = "720p",
  aspectRatio = "adaptive"
}) {
  validateReferences({ imageUrls, videoUrls });
  const payload = {
    model: SEEDANCE_MODEL,
    prompt,
    duration,
    quality,
    aspect_ratio: aspectRatio,
    generate_audio: false
  };
  if (imageUrls.length > 0) payload.image_urls = imageUrls;
  if (videoUrls.length > 0) payload.video_urls = videoUrls;
  return payload;
}

export function safeUploadName(name) {
  const match = name.match(/^(.*?)(\.[a-zA-Z0-9]+)?$/);
  const base = match?.[1] || "upload";
  const ext = (match?.[2] || "").toLowerCase();
  const cleaned = base
    .toLowerCase()
    .replace(/[^a-z0-9._]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return `${cleaned || "upload"}${ext}`;
}

export function isSafeUploadedFileName(name) {
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name) && !name.includes("/") && !name.includes("\\") && !name.includes("..");
}

export function buildPublicUploadUrl(origin, fileName) {
  return `${origin.replace(/\/$/, "")}/api/temp-files/${fileName}`;
}

export function isPublicHttpOrigin(origin) {
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") return false;
    if (/^10\./.test(host)) return false;
    if (/^192\.168\./.test(host)) return false;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

export async function createEvolinkTask(apiKey, payload) {
  const response = await fetch(`${EVOLINK_API_BASE}/v1/videos/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body?.error?.message || `EvoLink request failed with ${response.status}`;
    throw new Error(message);
  }
  return body;
}

export async function getEvolinkTask(apiKey, taskId) {
  const response = await fetch(`${EVOLINK_API_BASE}/v1/tasks/${taskId}`, {
    headers: { Authorization: `Bearer ${apiKey}` }
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body?.error?.message || `Task request failed with ${response.status}`;
    throw new Error(message);
  }
  return body;
}
