import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPublicUploadUrl,
  buildSeedancePayload,
  defaultPrompt,
  safeUploadName,
  validateReferences
} from "../web/lib/evolink.mjs";
import { buildSpinManifest } from "../web/lib/spin.mjs";

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
    "http://localhost:3000/uploads/abc.webp"
  );
});

test("defaultPrompt uses requested hyper realistic green screen camera rotation", () => {
  const prompt = defaultPrompt();

  assert.match(prompt, /hyper-realistic 5-second fashion video/);
  assert.match(prompt, /LOCK POSE/);
  assert.match(prompt, /Solid green screen background only/);
  assert.match(prompt, /Green screen output suitable for compositing/);
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
