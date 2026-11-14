import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
spec = importlib.util.spec_from_file_location('package_mobile', ROOT / 'deploy/package_mobile.py')
package = importlib.util.module_from_spec(spec)
spec.loader.exec_module(package)


class MobilePackageTest(unittest.TestCase):
    def test_private_content_and_optional_media_without_opening_production_database(self):
        with tempfile.TemporaryDirectory() as directory:
            out = Path(directory) / 'app'
            with patch('sqlite3.connect', side_effect=AssertionError('build must not open a database')):
                report = package.build(out, limit=2)
            tree = json.loads((out / 'private/course.json').read_text(encoding='utf8'))
            items = [i for l in tree['levels'] for m in l['modules'] for i in m['items']]
            self.assertEqual(len(items), 2)
            self.assertEqual(len(list((out / 'private/lessons').glob('*.json'))), 2)
            self.assertGreater(report['media_bytes'], 0)
            self.assertFalse((out / 'private/accounts.json').exists())
            self.assertFalse((out / 'site/course.json').exists())
            self.assertFalse((out / 'site/database.sqlite').exists())
            self.assertTrue((out / 'site/sw.js').exists())
            html = (out / 'site/index.html').read_text(encoding='utf8')
            self.assertIn('/mobile/client.js', html)
            self.assertNotIn('/platform.js', html)
            self.assertNotIn('/offline.js', html)
            self.assertTrue(all(i['stars'] == 0 for i in items))

    def test_refuses_to_overwrite_an_existing_package(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            (path / 'important.txt').write_text('keep')
            with self.assertRaises(ValueError):
                package.build(path, limit=1)
            self.assertEqual((path / 'important.txt').read_text(), 'keep')


if __name__ == '__main__':
    unittest.main()
