import unittest

from outfit360.evolink import build_generation_payload, default_seedance_prompt


class EvoLinkTests(unittest.TestCase):
    def test_build_generation_payload_uses_seedance_reference_to_video(self):
        payload = build_generation_payload(
            image_urls=["https://example.com/keyframe.webp"],
            video_urls=["https://example.com/input.mp4"],
            prompt="rotate outfit",
            duration=5,
            quality="720p",
            aspect_ratio="adaptive",
        )

        self.assertEqual(payload["model"], "seedance-2.0-reference-to-video")
        self.assertEqual(payload["image_urls"], ["https://example.com/keyframe.webp"])
        self.assertEqual(payload["video_urls"], ["https://example.com/input.mp4"])
        self.assertEqual(payload["duration"], 5)
        self.assertEqual(payload["quality"], "720p")
        self.assertFalse(payload["generate_audio"])

    def test_default_seedance_prompt_requests_locked_360_outfit_rotation(self):
        prompt = default_seedance_prompt()

        self.assertIn("360 degree", prompt)
        self.assertIn("same outfit", prompt)
        self.assertIn("Fixed camera", prompt)


if __name__ == "__main__":
    unittest.main()
