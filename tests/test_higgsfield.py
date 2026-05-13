import unittest
from pathlib import Path

from outfit360.higgsfield import build_higgsfield_command, default_rotation_prompt


class HiggsfieldTests(unittest.TestCase):
    def test_build_higgsfield_command_uses_start_image_and_json_wait(self):
        command = build_higgsfield_command(
            start_image=Path("work/keyframe.png"),
            prompt="rotate subject",
            model="kling3_0",
            duration=5,
        )

        self.assertEqual(command[:4], ["higgsfield", "generate", "create", "kling3_0"])
        self.assertIn("--start-image", command)
        self.assertIn("work/keyframe.png", command)
        self.assertIn("--wait", command)
        self.assertIn("--json", command)

    def test_default_rotation_prompt_describes_fixed_360_fashion_spin(self):
        prompt = default_rotation_prompt()

        self.assertIn("360 degree", prompt)
        self.assertIn("same outfit", prompt)
        self.assertIn("transparent background", prompt)


if __name__ == "__main__":
    unittest.main()
