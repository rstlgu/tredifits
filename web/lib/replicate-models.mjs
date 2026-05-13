export const REPLICATE_MODELS = [
  { id: "runwayml/gen4-turbo", label: "Runway Gen-4 Turbo (single image)", imagesOnly: true },
  { id: "bytedance/seedance-2.0", label: "Seedance 2.0 (Replicate)", imagesOnly: false }
];

export function isReplicateModel(model) {
  return REPLICATE_MODELS.some((item) => item.id === model);
}

export function isReplicateImagesOnlyModel(model) {
  const entry = REPLICATE_MODELS.find((item) => item.id === model);
  return Boolean(entry && entry.imagesOnly);
}
