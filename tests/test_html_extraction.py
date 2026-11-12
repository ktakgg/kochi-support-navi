import json
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from extract_html import apply_extraction, extract_sections

URL = 'https://www.city.kochi.kochi.jp/soshiki/40/hataiku.html'
FIXTURE = Path(__file__).parent / 'fixtures/hataiku.html'

class HtmlExtractionTests(unittest.TestCase):
    def test_actual_official_article_preserves_table_and_conditions(self):
        sections = extract_sections(URL, FIXTURE.read_text())
        by_kind = {s['kind']: s['text'] for s in sections}
        self.assertIn('男性育休推進部門の認証 ｜ 10万円', by_kind['amount'])
        self.assertIn('いずれかの認定 ｜ 30万円', by_kind['amount'])
        self.assertIn('常時雇用する労働者', by_kind['eligibility'])
        self.assertIn('高知市税を滞納', by_kind['eligibility'])
        self.assertIn('認証等後6か月以内', by_kind['conditions'])
        self.assertIn('予算がなくなり次第終了', by_kind['conditions'])
        self.assertNotIn('細木病院', json.dumps(sections, ensure_ascii=False))

    def test_same_source_hash_replaces_old_nulls_and_does_not_certify_status(self):
        r = dict(url=URL, hash='same', fetched_at='2026-11-12', amount=None,
                 eligibility=None, checked_at=None, review_state='pending', rounds=[])
        apply_extraction(r, FIXTURE.read_text())
        self.assertIn('10万円', r['amount'])
        self.assertIn('企業', r['eligibility'])
        self.assertIsNone(r['checked_at'])
        self.assertEqual(r['review_state'], 'pending')
        self.assertEqual(r['rounds'], [])
        self.assertEqual(r['html_extraction']['source_hash'], 'same')

    def test_wrapped_headings_inline_tags_and_section_boundaries(self):
        page = '<nav><h2>補助金額</h2><p>999万円</p></nav><div id="main_body"><div><h3>対象者</h3><p>市内の<strong>事業者</strong><br>ただし滞納者は除く</p></div><div><h3>補助金額</h3><table><tr><th>種類</th><th>金額</th></tr><tr><td>A</td><td>10万円</td></tr></table></div><h3>その他のイベント</h3><p>別の内容</p></div>'
        sections = extract_sections(URL, page)
        self.assertEqual(sections[0]['text'], '市内の事業者\nただし滞納者は除く')
        self.assertEqual(sections[1]['text'], '種類 ｜ 金額\nA ｜ 10万円')
        self.assertEqual(len(sections), 2)

    def test_removed_sections_clear_previous_extraction(self):
        r = dict(url=URL, hash='new', fetched_at='now', amount='old', eligibility='old')
        apply_extraction(r, '<div id="main_body"><p>PDF参照</p></div>')
        self.assertIsNone(r['amount'])
        self.assertIsNone(r['eligibility'])
        self.assertEqual(r['html_extraction']['sections'], [])

    def test_no_article_container_does_not_extract_sidebar(self):
        self.assertEqual(extract_sections(URL, '<aside><h2>支援内容</h2><p>他の制度</p></aside>'), [])
