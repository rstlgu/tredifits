export const REPLICATE_MODELS = [
  { id: "runwayml/gen4-turbo", label: "Runway Gen-4 Turbo (single image)" }
];

export function isReplicateModel(model) {
  return REPLICATE_MODELS.some((item) => item.id === model);
}
