import copy
import sys
import unittest
from pathlib import Path
from unittest.mock import Mock
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from refresh_html import refresh_record
from crawl import next_page
from collections import deque
from extract_html import VERSION

class RefreshTests(unittest.TestCase):
    def test_failure_keeps_old_conditions_dates_and_source_hash(self):
        old={'url':'https://www.city.kochi.kochi.jp/soshiki/150/shinseikatsu.html','hash':'old','fetched_at':'before','amount':'30万円','eligibility':'世帯'}
        before=copy.deepcopy(old)
        for fetcher in [Mock(get=Mock(side_effect=TimeoutError())),Mock(get=Mock(return_value=(b'<html><h1>Maintenance</h1></html>','utf-8')))]:
            with self.assertRaises((TimeoutError,ValueError)):
                refresh_record(old,fetcher)
            self.assertEqual(old,before)

    def test_daily_existing_lane_prioritizes_old_extraction_without_losing_other_lanes(self):
        a='https://www.city.kochi.kochi.jp/soshiki/1/a.html';b='https://www.city.kochi.kochi.jp/soshiki/1/b.html'
        q=deque([(a,0),(b,0)])
        chosen,lane=next_page(q,{a:{'fetched_at':'2020'},b:{'fetched_at':'2026'}},{a,b},2,{a:VERSION,b:0})
        self.assertEqual((chosen,lane),((b,0),2))
