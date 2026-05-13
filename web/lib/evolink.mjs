export const EVOLINK_API_BASE = "https://api.evolink.ai";
export const SEEDANCE_MODEL = "seedance-2.0-reference-to-video";

export function defaultPrompt() {
  return `Create a hyper-realistic 5-second fashion video using all reference images and videos provided.

Subject and pose:

The subject must remain perfectly still in the exact same pose extracted from the reference video or photos, preserving every detail of posture, limb position, and body alignment as if performing a 3D scan.
LOCK POSE: no variation in body position, limb angles, head tilt, or facial expression.
LOCK IDENTITY: exact same face, hairstyle, skin tone, body proportions.
LOCK OUTFIT: exact same clothing, shoes, accessories, fabric textures, stitching, front/back details.

Camera movement:

Smooth 360° rotation around the subject in a single complete turn.
Perfectly fluid, continuous, and evenly paced, with no stutter, jump, or frame artifacts.
Subject remains centered and full-body framed at fixed distance.

Background:

Solid green screen background only, seamless and uniform.
No environment changes, props, reflections, or extra elements.

Lighting and realism:

Clean studio lighting, realistic fabric behavior, accurate garment structure from every angle.
No animation of clothing, hair, or body beyond what is visible in reference.

Consistency enforcement:

LOCK ALL DETAILS across frames: identity, pose, outfit, shoes, hair, facial expression, body proportions.
Absolute fidelity to references: the AI must treat references as the only source for appearance, posture, and clothing.

Output instructions:

High-resolution, realistic fashion video, maintaining ultra-consistent appearance and seamless 360° rotation.
Green screen output suitable for compositing into any background`;
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
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return `${cleaned || "upload"}${ext}`;
}

export function buildPublicUploadUrl(origin, fileName) {
  return `${origin.replace(/\/$/, "")}/uploads/${fileName}`;
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
