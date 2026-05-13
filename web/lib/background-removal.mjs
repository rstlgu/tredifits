export function hasInHouseBackgroundRemoval(env = process.env) {
  return env.LOCAL_INHOUSE_MATTING === "1";
}

export async function removeBackgroundInHouse({ bytes }) {
  if (!hasInHouseBackgroundRemoval()) {
    return bytes;
  }

  const dynamicImport = new Function("specifier", "return import(specifier)");
  const [{ pipeline, env }, sharpModule] = await Promise.all([
    dynamicImport("@huggingface/transformers"),
    dynamicImport("sharp")
  ]);
  const sharp = sharpModule.default;

  env.allowLocalModels = false;
  env.backends.onnx.wasm.numThreads = 1;

  if (!globalThis.__tredifitsSegmenterPromise) {
    globalThis.__tredifitsSegmenterPromise = pipeline("image-segmentation", "Xenova/modnet", { device: "cpu" });
  }

  const image = sharp(bytes).ensureAlpha();
  const metadata = await image.metadata();
  const width = metadata.width;
  const height = metadata.height;
  if (!width || !height) throw new Error("Frame non valido per background removal.");

  const segmenter = await globalThis.__tredifitsSegmenterPromise;
  const dataUrl = `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;
  const result = await segmenter(dataUrl);
  const maskSource = Array.isArray(result) ? result[0]?.mask : result?.mask;
  if (!maskSource) throw new Error("Il modello non ha restituito una maschera.");

  const maskBytes = Buffer.from(await maskSource.toRaw());
  const maskMeta = maskSource.size || {};
  const maskWidth = maskMeta.width || width;
  const maskHeight = maskMeta.height || height;
  const alpha = await sharp(maskBytes, {
    raw: { width: maskWidth, height: maskHeight, channels: 1 }
  })
    .resize(width, height, { fit: "fill" })
    .median(3)
    .blur(0.4)
    .raw()
    .toBuffer();

  return image
    .joinChannel(alpha, { raw: { width, height, channels: 1 } })
    .png()
    .toBuffer();
}
