import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPublicUploadUrl,
  buildSeedancePayload,
  defaultPrompt,
  isSafeUploadedFileName,
  isPublicHttpOrigin,
  safeUploadName,
  validateReferences
} from "../web/lib/evolink.mjs";
import { buildSpinManifest } from "../web/lib/spin.mjs";
import { buildSupabaseObjectPath, buildSupabaseRenderObjectPath, isSafeSupabaseObjectPath } from "../web/lib/supabase-storage.mjs";
import { hasInHouseBackgroundRemoval } from "../web/lib/background-removal.mjs";

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

test("defaultPrompt uses requested hyper realistic green screen camera rotation", () => {
  const prompt = defaultPrompt();

  assert.match(prompt, /hyper-realistic 5-second fashion video/);
  assert.match(prompt, /only the camera rotates smoothly 360/);
  assert.match(prompt, /Solid pure green screen background only/);
  assert.match(prompt, /Ultra-consistent identity and outfit continuity/);
});

test("validateReferences allows either max two images or one video", () => {
  assert.doesNotThrow(() => validateReferences({ imageUrls: ["https://a.test/1.webp", "https://a.test/2.webp"], videoUrls: [] }));
  assert.doesNotThrow(() => validateReferences({ imageUrls: [], videoUrls: ["https://a.test/v.mp4"] }));
  assert.throws(() => validateReferences({ imageUrls: ["1", "2", "3"], videoUrls: [] }), /massimo 2 foto/);
  assert.throws(() => validateReferences({ imageUrls: ["1"], videoUrls: ["v"] }), /Scegli foto oppure video/);
});

test("buildSpinManifest emits yafa style frame urls", () => {
  const manifest = buildSpinManifest({ id: "render-1", prefix: "frame_", frameCount: 3, ext: "webp" });

  assert.deepEqual(manifest.frames, [
    "/renders/render-1/frames/frame_00000.webp",
    "/renders/render-1/frames/frame_00001.webp",
    "/renders/render-1/frames/frame_00002.webp"
  ]);
});

test("hasInHouseBackgroundRemoval is available without external api key", () => {
  assert.equal(hasInHouseBackgroundRemoval(), true);
});
