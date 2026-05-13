import sharp from "sharp";

let segmenterPromise;

export function hasInHouseBackgroundRemoval() {
  return true;
}

async function getSegmenter() {
  if (!segmenterPromise) {
    segmenterPromise = import("@huggingface/transformers").then(({ pipeline, env }) => {
      env.allowLocalModels = false;
      env.backends.onnx.wasm.numThreads = 1;
      return pipeline("image-segmentation", "Xenova/modnet", { device: "cpu" });
    });
  }
  return segmenterPromise;
}

export async function removeBackgroundInHouse({ bytes }) {
  const image = sharp(bytes).ensureAlpha();
  const metadata = await image.metadata();
  const width = metadata.width;
  const height = metadata.height;
  if (!width || !height) {
    throw new Error("Frame non valido per background removal.");
  }

  const segmenter = await getSegmenter();
  const result = await segmenter(bytes);
  const maskSource = Array.isArray(result) ? result[0]?.mask : result?.mask;
  if (!maskSource) {
    throw new Error("Il modello non ha restituito una maschera.");
  }

  const maskBytes = Buffer.from(await maskSource.toRaw());
  const maskMeta = maskSource.size || {};
  const maskWidth = maskMeta.width || width;
  const maskHeight = maskMeta.height || height;
  const alpha = await sharp(maskBytes, {
    raw: {
      width: maskWidth,
      height: maskHeight,
      channels: 1
    }
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
