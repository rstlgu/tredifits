export function hasInHouseBackgroundRemoval(env = process.env) {
  return env.LOCAL_INHOUSE_MATTING === "1";
}

export function createSegmenterImageInput(bytes) {
  return new Blob([bytes], { type: "image/png" });
}

export async function normalizeMaskAlpha({ sharp, maskBytes, maskWidth, maskHeight, width, height }) {
  let mask = sharp(maskBytes, {
    raw: { width: maskWidth, height: maskHeight, channels: 1 }
  })
    .resize(width, height, { fit: "fill" })
    .greyscale();
  if (width >= 3 && height >= 3) {
    mask = mask.median(3).blur(0.4);
  }
  return mask.raw().toBuffer();
}

export async function applyAlphaMask({ sharp, image, alpha, width, height }) {
  if (alpha.length !== width * height) {
    throw new Error(`Maschera alpha non valida: ${alpha.length} byte per ${width}x${height}.`);
  }

  const { data } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const rgba = Buffer.from(data);
  for (let pixel = 0, alphaIndex = 3; pixel < alpha.length; pixel += 1, alphaIndex += 4) {
    rgba[alphaIndex] = alpha[pixel];
  }

  return sharp(rgba, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();
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
  const result = await segmenter(createSegmenterImageInput(bytes));
  const maskSource = Array.isArray(result) ? result[0]?.mask : result?.mask;
  if (!maskSource) throw new Error("Il modello non ha restituito una maschera.");

  let maskBytes;
  let maskMeta = maskSource.size || {};
  if (typeof maskSource.toRaw === "function") {
    maskBytes = Buffer.from(await maskSource.toRaw());
  } else if (maskSource.data) {
    maskBytes = Buffer.from(maskSource.data);
    maskMeta = { width: maskSource.width || maskMeta.width, height: maskSource.height || maskMeta.height };
  } else {
    throw new Error(`Formato maschera non supportato: ${Object.keys(maskSource).join(",")}`);
  }
  const maskWidth = maskMeta.width || width;
  const maskHeight = maskMeta.height || height;
  const alpha = await normalizeMaskAlpha({ sharp, maskBytes, maskWidth, maskHeight, width, height });

  return applyAlphaMask({ sharp, image, alpha, width, height });
}
