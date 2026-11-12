import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from collect_structured import api_record,rss_records,relevant
class StructuredTests(unittest.TestCase):
 def data(self):return {'id':'a0WfQ000003N1RYUA0','title':'補助金<script>bad</script>','institution_name':'制度の名称','subsidy_max_limit':0,'subsidy_rate':None,'workflow':[{'target_area_search':'全国','acceptance_start_datetime':'2026-10-01T00:00Z','acceptance_end_datetime':'2026-11-01T08:30Z'},{'target_area_search':'東京都','acceptance_start_datetime':'2027-01-01T00:00Z','acceptance_end_datetime':'2027-02-01T08:30Z'}]}
 def test_regions_exact_and_national(self):
  self.assertTrue(relevant('全国'));self.assertTrue(relevant('愛媛県 / 高知県'));self.assertTrue(relevant('四国地方'));self.assertFalse(relevant('東京都'));self.assertFalse(relevant(None))
 def test_workflows_filter_before_status_and_do_not_invent_issuer(self):
  r=api_record(self.data(),'2026-10-29T00:00Z');self.assertEqual(len(r['rounds']),1);self.assertIsNone(r['issuer_name']);self.assertIsNone(r['amount']);self.assertIsNone(r['checked_at']);self.assertEqual(r['review_state'],'structured');self.assertNotIn('<script>',r['title'])
 def test_reject_malformed_date(self):
  d=self.data();d['workflow'][0]['acceptance_end_datetime']='bad'
  with self.assertRaises(ValueError):api_record(d,'now')
 def test_other_prefecture_is_not_published(self):
  d=self.data();d['workflow']=d['workflow'][1:];self.assertIsNone(api_record(d,'now'))
 def test_rss_region_and_no_inferred_dates(self):
  xml=b'<rss xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><channel><item><title>&#35036;&#21161;&#37329;</title><link>https://j-net21.smrj.go.jp/snavi/articles/123</link><dc:coverage><rdf:value>JP-39</rdf:value></dc:coverage><description>2026-11-01</description></item></channel></rss>'
  rows,n=rss_records(xml,'now');self.assertEqual(n,1);self.assertEqual(len(rows),1);self.assertEqual(rows[0]['rounds'],[]);self.assertEqual(rows[0]['review_state'],'pending')
 def test_xml_entities_rejected(self):
  with self.assertRaises(ValueError):rss_records(b'<!DOCTYPE rss><rss/>','now')
 def test_summary_window_does_not_claim_applications_open(self):
  from collect_structured import summary_record
  d=self.data();d.update(d['workflow'][0]);r=summary_record(d,'now');self.assertFalse(r['rounds'][0]['confirmed_open'])
 def test_post_award_procedures_are_not_new_applications(self):
  d=self.data();d['title']='事業再構築補助金（交付申請等）';r=api_record(d,'now');self.assertFalse(r['rounds'][0]['confirmed_open'])
