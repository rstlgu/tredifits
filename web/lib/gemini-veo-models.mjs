export const VEO_MODELS = [
  { id: "veo-3.1-generate-preview", label: "Veo 3.1 Standard" },
  { id: "veo-3.1-fast-generate-preview", label: "Veo 3.1 Fast" },
  { id: "veo-3.1-lite-generate-preview", label: "Veo 3.1 Lite" }
];

export function isGeminiVeoModel(model) {
  return VEO_MODELS.some((item) => item.id === model);
}

export function normalizeGeminiResolution(quality, model = "veo-3.1-generate-preview") {
  if (quality === "4k" && model !== "veo-3.1-lite-generate-preview") return "4k";
  if (quality === "1080p") return "1080p";
  if (quality === "4k" && model === "veo-3.1-lite-generate-preview") return "1080p";
  return "720p";
}
