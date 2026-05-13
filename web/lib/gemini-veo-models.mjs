export const VEO_MODELS = [
  { id: "veo-3.1-generate-preview", label: "Veo 3.1 Standard" },
  { id: "veo-3.1-fast-generate-preview", label: "Veo 3.1 Fast" },
  { id: "veo-3.1-lite-generate-preview", label: "Veo 3.1 Lite" },
  { id: "veo-3.0-generate-001", label: "Veo 3.0 (single image)" }
];

export function isGeminiVeoModel(model) {
  return VEO_MODELS.some((item) => item.id === model);
}

export function isVeo30Model(model) {
  return model === "veo-3.0-generate-001";
}

export function normalizeGeminiResolution(quality, model = "veo-3.1-generate-preview") {
  if (isVeo30Model(model)) {
    if (quality === "1080p") return "1080p";
    return "720p";
  }
  if (quality === "4k" && model !== "veo-3.1-lite-generate-preview") return "4k";
  if (quality === "1080p") return "1080p";
  if (quality === "4k" && model === "veo-3.1-lite-generate-preview") return "1080p";
  return "720p";
}
