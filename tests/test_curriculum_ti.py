import json
import re
import unittest

import media_store
import server


class CurriculumTITest(unittest.TestCase):
    def test_blue_red_ti_tracks_and_bundled_audio(self):
        server.build_index(seed_progress=False)
        es_levels = {lvl["level"]: lvl for lvl in server.TREE.get("es", [])}
        for code in ("BLUE", "RED", "TI"):
            self.assertIn(code, es_levels, f"Missing level {code}")
            self.assertEqual(len(es_levels[code]["modules"]), 3)

        cyber_items = [iid for iid, meta in server.ITEMS.items() if meta["level"] in ("BLUE", "RED", "TI")]
        self.assertEqual(len(cyber_items), 45)

        all_refs = set()
        total_exercises = 0
        for iid in cyber_items:
            out = server.load_item(iid)
            self.assertEqual(out["availability"]["missing"], 0, f"Missing media in {iid}")
            self.assertEqual(len(out["exercises"]), 12, f"Expected 12 exercises in {iid}, got {len(out['exercises'])}")
            total_exercises += len(out["exercises"])
            refs = set(re.findall(r'/m/([^\s"<>]+)', json.dumps(out, ensure_ascii=False)))
            all_refs.update(refs)

        self.assertEqual(total_exercises, 540)
        self.assertEqual(len(all_refs), 288)
        for name in sorted(all_refs):
            with media_store.media_file("media_all/" + name) as path:
                self.assertTrue(path.exists(), f"Missing bundled audio file for {name}")
                self.assertGreater(path.stat().st_size, 1000, f"Empty/corrupt audio file for {name}")


if __name__ == "__main__":
    unittest.main()
