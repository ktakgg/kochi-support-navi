"""Build the whole catalog at both host-root and repository-prefix URLs."""
import contextlib
import io
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import build
import validate_site


class PagesBuildTests(unittest.TestCase):
    def test_all_generated_links_at_root_and_repository_prefix(self):
        for prefix in ('', '/kochi-support-navi'):
            with self.subTest(prefix=prefix), tempfile.TemporaryDirectory() as directory:
                output = Path(directory)
                with patch.object(build, 'DIST', output), patch.object(validate_site, 'DIST', output), patch.dict(os.environ, {'BASE_PATH': prefix}), contextlib.redirect_stdout(io.StringIO()):
                    build.main()
                    validate_site.validate()
                detail = next((output / 'support').glob('*/index.html')).read_text()
                self.assertIn(f"from'{prefix}/core.mjs'", detail)
                self.assertTrue((output / '.nojekyll').exists())


if __name__ == '__main__':
    unittest.main()
