import tempfile
import unittest
from pathlib import Path

from outfit360.pipeline import build_frame_name, select_evenly_spaced, write_viewer


class PipelineTests(unittest.TestCase):
    def test_select_evenly_spaced_keeps_order_and_edges(self):
        frames = [Path(f"{i:05d}.png") for i in range(10)]

        selected = select_evenly_spaced(frames, 4)

        self.assertEqual([p.name for p in selected], ["00000.png", "00003.png", "00006.png", "00009.png"])

    def test_build_frame_name_uses_yafa_style_padding(self):
        self.assertEqual(build_frame_name("outfit_001_", 7, "webp"), "outfit_001_00007.webp")

    def test_write_viewer_references_sequence_metadata(self):
        with tempfile.TemporaryDirectory() as tmp:
            out_dir = Path(tmp)

            write_viewer(out_dir, prefix="outfit_001_", frame_count=120, ext="webp")

            html = (out_dir / "index.html").read_text()
            self.assertIn("const FRAME_COUNT = 120;", html)
            self.assertIn("const PREFIX = 'outfit_001_';", html)
            self.assertIn("padStart(5, '0')", html)


if __name__ == "__main__":
    unittest.main()
