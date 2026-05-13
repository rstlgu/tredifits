export function frameName(prefix, index, ext) {
  return `${prefix}${String(index).padStart(5, "0")}.${ext}`;
}

export function buildSpinManifest({ id, prefix = "frame_", frameCount, ext = "webp" }) {
  const frames = Array.from({ length: frameCount }, (_unused, index) => {
    return `/renders/${id}/frames/${frameName(prefix, index, ext)}`;
  });

  return {
    id,
    prefix,
    frameCount,
    ext,
    frames
  };
}
