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
                hataiku=(output/'support/6a16f5f36647c945/index.html').read_text()
                self.assertNotIn('制度の詳細条件は掲載元の公式ページをご確認ください。',hataiku)
                self.assertNotIn('対象地域：公式案内',hataiku)
                self.assertIn('<td>10万円</td>',hataiku)
                self.assertIn('<td>30万円</td>',hataiku)
                self.assertIn('高知市税を滞納',hataiku)
                self.assertIn('令和7年10月2日以後',hataiku)
                self.assertIn('認証等後6か月以内',hataiku)
                marriage=(output/'support/c4599b1192ac691d/index.html').read_text()
                for content in ['家賃や引越費用を支援します。','1世帯あたり30万円','45万円','39歳以下','500万円未満','2年以上継続','令和9年2月26日','令和9年2月28日']:
                    self.assertIn(content,marriage)


if __name__ == '__main__':
    unittest.main()
