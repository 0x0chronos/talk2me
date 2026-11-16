import json
import re
import unittest

import media_store
import server


class CurriculumTITest(unittest.TestCase):
    def test_nivel_ti_units_and_bundled_audio(self):
        server.build_index(seed_progress=False)
        ti_levels = [lvl for lvl in server.TREE.get("es", []) if lvl["level"] == "TI"]
        self.assertEqual(len(ti_levels), 1)
        self.assertEqual(ti_levels[0]["label"], "TI & Ciberseguridad (España)")
        self.assertEqual(len(ti_levels[0]["modules"]), 4)

        ti_items = [iid for iid, meta in server.ITEMS.items() if meta["level"] == "TI"]
        self.assertEqual(len(ti_items), 20)

        all_refs = set()
        for iid in ti_items:
            out = server.load_item(iid)
            self.assertEqual(out["availability"]["missing"], 0, f"Missing media in {iid}")
            self.assertGreaterEqual(len(out["exercises"]), 5)
            refs = set(re.findall(r'/m/([^\s"<>]+)', json.dumps(out, ensure_ascii=False)))
            all_refs.update(refs)

        self.assertEqual(len(all_refs), 128)
        for name in sorted(all_refs):
            with media_store.media_file("media_all/" + name) as path:
                self.assertTrue(path.exists(), f"Missing bundled audio file for {name}")
                self.assertGreater(path.stat().st_size, 1000, f"Empty/corrupt audio file for {name}")


if __name__ == "__main__":
    unittest.main()
