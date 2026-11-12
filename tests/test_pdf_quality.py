import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from collect_pdfs import needs_ocr

class PdfQualityTests(unittest.TestCase):
 def test_unsupported_japanese_encoding_is_not_readable_evidence(self):
  original=('令和７年度介護事業所等に対するサービス継続支援事業実施要綱\n'*30)
  damaged=original.encode('cp932').decode('latin1')
  self.assertTrue(needs_ocr(damaged))
  self.assertFalse(needs_ocr(original))
