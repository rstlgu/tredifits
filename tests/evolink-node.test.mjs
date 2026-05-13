import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";

import {
  applyAlphaMask,
  createSegmenterImageInput,
  hasInHouseBackgroundRemoval,
  normalizeMaskAlpha
} from "../web/lib/background-removal.mjs";
import {
  buildPublicUploadUrl,
  buildSeedancePayload,
  defaultPrompt,
  isSafeUploadedFileName,
  isPublicHttpOrigin,
  safeUploadName,
  validateReferences
} from "../web/lib/evolink.mjs";
import {
  buildGeminiVeoPayload,
  decodeGeminiOperationId,
  encodeGeminiOperationId,
  isGeminiVeoModel,
  normalizeGeminiResolution,
  VEO_MODELS
} from "../web/lib/gemini-veo.mjs";
import { buildSpinManifest } from "../web/lib/spin.mjs";
import { buildSupabaseObjectPath, buildSupabaseRenderObjectPath, isSafeSupabaseObjectPath } from "../web/lib/supabase-storage.mjs";

test("buildSeedancePayload creates reference-to-video request", () => {
  const payload = buildSeedancePayload({
    imageUrls: ["https://example.com/a.webp"],
    videoUrls: [],
    prompt: "rotate",
    duration: 5,
    quality: "720p",
    aspectRatio: "adaptive"
  });

  assert.equal(payload.model, "seedance-2.0-reference-to-video");
  assert.deepEqual(payload.image_urls, ["https://example.com/a.webp"]);
  assert.equal(payload.video_urls, undefined);
  assert.equal(payload.generate_audio, false);
});

test("safeUploadName strips unsafe characters", () => {
  assert.equal(
    safeUploadName("My Look 01!.webp"),
    "my-look-01.webp"
  );
});

test("buildPublicUploadUrl uses request origin and upload path", () => {
  assert.equal(
    buildPublicUploadUrl("http://localhost:3000", "abc.webp"),
    "http://localhost:3000/api/temp-files/abc.webp"
  );
});

test("isPublicHttpOrigin rejects local and private origins", () => {
  assert.equal(isPublicHttpOrigin("https://demo.example.com"), true);
  assert.equal(isPublicHttpOrigin("http://localhost:3000"), false);
  assert.equal(isPublicHttpOrigin("http://192.168.100.1:3000"), false);
  assert.equal(isPublicHttpOrigin("ftp://example.com"), false);
});

test("isSafeUploadedFileName only accepts flat upload filenames", () => {
  assert.equal(isSafeUploadedFileName("123-keyframe.webp"), true);
  assert.equal(isSafeUploadedFileName("../.env"), false);
  assert.equal(isSafeUploadedFileName("nested/file.webp"), false);
});

test("buildSupabaseObjectPath creates temp scoped object path", () => {
  const path = buildSupabaseObjectPath({ fileName: "My Clip!.mp4", id: "abc123" });

  assert.equal(path, "temp/abc123/my-clip.mp4");
});

test("isSafeSupabaseObjectPath only accepts temp scoped paths", () => {
  assert.equal(isSafeSupabaseObjectPath("temp/abc/file.webp"), true);
  assert.equal(isSafeSupabaseObjectPath("renders/abc/file.webp"), true);
  assert.equal(isSafeSupabaseObjectPath("../file.webp"), false);
  assert.equal(isSafeSupabaseObjectPath("public/file.webp"), false);
});

test("buildSupabaseRenderObjectPath creates render scoped object path", () => {
  assert.equal(buildSupabaseRenderObjectPath({ renderId: "spin-1", fileName: "frame_00001.webp" }), "renders/spin-1/frame_00001.webp");
});

test("defaultPrompt uses requested hyper realistic white background camera rotation", () => {
  const prompt = defaultPrompt();

  assert.match(prompt, /hyper-realistic 5-second fashion video/);
  assert.match(prompt, /only the camera rotates smoothly 360/);
  assert.match(prompt, /flat pure white background/);
  assert.match(prompt, /No shadows on the background/);
  assert.match(prompt, /no floor line/);
  assert.match(prompt, /must remain exactly #ffffff/);
  assert.match(prompt, /perfectly uniform white matte/);
  assert.match(prompt, /Ultra-consistent identity and outfit continuity/);
});

test("validateReferences allows either max two images or one video", () => {
  assert.doesNotThrow(() => validateReferences({ imageUrls: ["https://a.test/1.webp", "https://a.test/2.webp"], videoUrls: [] }));
  assert.doesNotThrow(() => validateReferences({ imageUrls: [], videoUrls: ["https://a.test/v.mp4"] }));
  assert.throws(() => validateReferences({ imageUrls: ["1", "2", "3"], videoUrls: [] }), /massimo 2 foto/);
  assert.throws(() => validateReferences({ imageUrls: ["1"], videoUrls: ["v"] }), /Scegli foto oppure video/);
});

test("Veo model registry contains Gemini 3.1 preview variants", () => {
  assert.deepEqual(VEO_MODELS.map((item) => item.id), [
    "veo-3.1-generate-preview",
    "veo-3.1-fast-generate-preview",
    "veo-3.1-lite-generate-preview"
  ]);
  assert.equal(isGeminiVeoModel("veo-3.1-fast-generate-preview"), true);
  assert.equal(isGeminiVeoModel("seedance-2.0-reference-to-video"), false);
});

test("buildGeminiVeoPayload creates reference image request", () => {
  const payload = buildGeminiVeoPayload({
    model: "veo-3.1-fast-generate-preview",
    prompt: "rotate",
    images: [
      { mimeType: "image/png", data: "aaa" },
      { mimeType: "image/jpeg", data: "bbb" }
    ],
    quality: "1080p",
    aspectRatio: "16:9"
  });

  assert.deepEqual(payload, {
    instances: [{
      prompt: "rotate",
      referenceImages: [
        { image: { inlineData: { mimeType: "image/png", data: "aaa" } }, referenceType: "asset" },
        { image: { inlineData: { mimeType: "image/jpeg", data: "bbb" } }, referenceType: "asset" }
      ]
    }],
    parameters: {
      aspectRatio: "16:9",
      resolution: "1080p"
    }
  });
});

test("buildGeminiVeoPayload rejects video references", () => {
  assert.throws(
    () => buildGeminiVeoPayload({ model: "veo-3.1-generate-preview", prompt: "x", images: [], videoUrls: ["https://x.test/a.mp4"] }),
    /Veo 3.1 supporta reference immagini/
  );
});

test("normalizeGeminiResolution maps unsupported values", () => {
  assert.equal(normalizeGeminiResolution("480p"), "720p");
  assert.equal(normalizeGeminiResolution("4k", "veo-3.1-lite-generate-preview"), "1080p");
});

test("Gemini operation ids round trip safely through routes", () => {
  const operationName = "operations/abc-123";
  assert.equal(decodeGeminiOperationId(encodeGeminiOperationId(operationName)), operationName);
});

test("buildSpinManifest emits yafa style frame urls", () => {
  const manifest = buildSpinManifest({ id: "render-1", prefix: "frame_", frameCount: 3, ext: "webp" });

  assert.deepEqual(manifest.frames, [
    "/renders/render-1/frames/frame_00000.webp",
    "/renders/render-1/frames/frame_00001.webp",
    "/renders/render-1/frames/frame_00002.webp"
  ]);
});

test("hasInHouseBackgroundRemoval is gated by local flag", () => {
  assert.equal(hasInHouseBackgroundRemoval({ LOCAL_INHOUSE_MATTING: "1" }), true);
  assert.equal(hasInHouseBackgroundRemoval({ LOCAL_INHOUSE_MATTING: "0" }), false);
});

test("createSegmenterImageInput passes image bytes without data urls", async () => {
  const bytes = Buffer.from([1, 2, 3, 4]);
  const input = createSegmenterImageInput(bytes);

  assert.equal(typeof input, "object");
  assert.equal(input instanceof Blob, true);
  assert.equal(input.type, "image/png");
  assert.deepEqual(Buffer.from(await input.arrayBuffer()), bytes);
});

test("normalizeMaskAlpha keeps a single alpha byte per pixel", async () => {
  const alpha = await normalizeMaskAlpha({
    sharp,
    maskBytes: Buffer.from([0, 128, 255, 64]),
    maskWidth: 2,
    maskHeight: 2,
    width: 2,
    height: 2
  });

  assert.equal(alpha.length, 4);
  assert.deepEqual([...alpha], [0, 128, 255, 64]);
});

test("applyAlphaMask replaces an opaque source alpha channel", async () => {
  const image = sharp({
    create: {
      width: 2,
      height: 1,
      channels: 4,
      background: { r: 10, g: 20, b: 30, alpha: 1 }
    }
  });
  const output = await applyAlphaMask({
    sharp,
    image,
    alpha: Buffer.from([0, 255]),
    width: 2,
    height: 1
  });
  const raw = await sharp(output).raw().toBuffer({ resolveWithObject: true });

  assert.equal(raw.info.channels, 4);
  assert.deepEqual([...raw.data], [10, 20, 30, 0, 10, 20, 30, 255]);
});
