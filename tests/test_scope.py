import sys, unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from scope import outside_reason


def api(title, summary='', keywords=None, kind='api'):
    return {'id': 'x', 'title': title, 'summary': summary, 'keywords': keywords or [], 'data_kind': kind}


class ScopeTest(unittest.TestCase):
    def test_other_municipalities_registered_as_nationwide_are_hidden(self):
        for title in ['京都市企業立地促進制度補助金［お試し立地支援制度］', '【倉敷市】実証実験サポート事業', 'いわき市診療所開設・承継支援補助金',
                      '令和８年度東京港物流効率化等事業補助金', '休廃止鉱山鉱害防止等工事費補助金【九州監督部】', '申請練習用補助金']:
            self.assertIsNotNone(outside_reason(api(title)), title)
        self.assertIsNotNone(outside_reason(api('京都型グローバル・ニッチ・トップ企業育成補助金', keywords=['京都市企業立地促進制度'])))
        self.assertIsNotNone(outside_reason(api('【香美市】補助金・助成金：「移動スーパー支援金」', kind='rss')))
        self.assertIsNotNone(outside_reason(api('SDGsファイナンス支援事業補助金', 'SDGsファイナンス補助金　東京都　個人向けSDGs預金')))

    def test_national_shikoku_and_kochi_programs_stay(self):
        for title in ['【経済産業省】ものづくり・商業・サービス生産性向上促進補助金', '休廃止鉱山鉱害防止等工事費補助金【四国支部】',
                      '【高知】令和８年度中小企業最低賃金引上げ支援対策費補助金', '都市ガス分野の災害対応・レジリエンス強化に係る支援事業費補助金',
                      '全国の市町村が行う事業を支援']:
            self.assertIsNone(outside_reason(api(title)), title)
        self.assertIsNone(outside_reason(api('系統用蓄電池等導入支援', '再エネの導入が先行している北海道や九州といった地域では')))

    def test_kochi_official_html_is_never_hidden(self):
        self.assertIsNone(outside_reason({'id': 'y', 'title': '高知市地方創生移住支援金（東京都からの移住者）', 'summary': '東京都 内に在住'}))
