import unittest,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from crawl import canonical,parse_page,classify
class CrawlerTests(unittest.TestCase):
 def test_external_and_attachments_excluded(self):
  for url in ['https://evil.example/','http://evil.example/a','https://www.city.kochi.kochi.jp/a.pdf','https://www.city.kochi.kochi.jp/a?x=1']:self.assertIsNone(canonical(url))
 def test_hash_ignores_navigation(self):
  a='<h1>補助金</h1><nav>変更前</nav><div id="main_body"><p>条件</p><a href="/a.pdf">募集要領</a></div>'
  b=a.replace('変更前','変更後')
  self.assertEqual(parse_page('https://www.city.kochi.kochi.jp/a',a)[1],parse_page('https://www.city.kochi.kochi.jp/a',b)[1])
  self.assertEqual(len(parse_page('https://www.city.kochi.kochi.jp/a',a)[3]),1)
 def test_classification_does_not_assume_unknown_is_personal(self):self.assertEqual(classify('不明な助成金')[0],['対象者を確認'])
if __name__=='__main__':unittest.main()

class MultiSourceTests(unittest.TestCase):
 def test_configured_sources_and_aliases(self):
  from sources import source_meta,canonical
  self.assertEqual(source_meta('https://www.pref.kochi.lg.jp/doc/123/')['source_level'],'県')
  self.assertEqual(source_meta('https://www.chusho.meti.go.jp/keiei/')['source_level'],'国')
  self.assertEqual(canonical('https://joho-kochi.or.jp/center/r8top.php'),canonical('https://www.joho-kochi.or.jp/center/r8top.php'))
  self.assertIsNone(canonical('https://www.cciweb.or.jp/another-city/'))
  self.assertEqual(canonical('http://www.cciweb.or.jp/kochi/sodan/joseikin.html'),'http://www.cciweb.or.jp/kochi/sodan/joseikin.html')
  self.assertEqual(canonical('http://www.cciweb.or.jp/kochi/index.html'),'http://www.cciweb.or.jp/kochi/index.html')
  self.assertEqual(canonical('https://www.cciweb.or.jp/kochi/'),'http://www.cciweb.or.jp/kochi/index.html')
  self.assertEqual(canonical('http://www.city.kochi.kochi.jp/index.html'),'https://www.city.kochi.kochi.jp/')
 def test_prefecture_title_and_updated_date_ignore_logo_and_publication_date(self):
  html='<header><h1><img alt="高知県"></h1></header><div id="pageTitle"><h1>高知県の補助金</h1></div><article class="contentGpArticleDoc"><div class="date">公開日 2025年04月01日 更新日 2026年09月01日</div><p>対象条件</p></article>'
  title,body,_,_,updated=parse_page('https://www.pref.kochi.lg.jp/doc/test/',html)
  self.assertEqual(title,'高知県の補助金');self.assertEqual(updated,'更新日：2026年09月01日')
 def test_robots_failure_is_isolated(self):
  from sources import Fetcher,SOURCES
  import urllib.error
  f=Fetcher(delay=0);f.raw=lambda url: (_ for _ in ()).throw(urllib.error.HTTPError(url,403,'Forbidden',{},None))
  self.assertFalse(f.prepare(next(s for s in SOURCES if s['id']=='chusho')))
  self.assertNotIn('kochi_pref',f.status)
 def test_untrusted_redirect_is_rejected(self):
  from sources import SafeRedirect
  import urllib.request
  with self.assertRaises(ValueError):SafeRedirect().redirect_request(urllib.request.Request('https://www.pref.kochi.lg.jp/doc/1/'),None,302,'',{},'https://evil.example/file')

class DiscoveryRegressionTests(unittest.TestCase):
 def test_migration_support_is_candidate(self):
  from crawl import is_candidate,classify
  title='「高知市地方創生移住支援金」の支給について'
  self.assertTrue(is_candidate(title,'https://www.city.kochi.kochi.jp/soshiki/117/ijusienkin.html'))
  self.assertIn('個人・世帯',classify(title)[0]);self.assertIn('住まい',classify(title)[1])
 def test_department_indexes_are_followed(self):
  from crawl import discover_link
  self.assertTrue(discover_link('https://www.city.kochi.kochi.jp/soshiki/117/','移住・定住促進課'))
  self.assertTrue(discover_link('https://www.city.kochi.kochi.jp/soshiki/40/','商業振興・外商支援課'))
  self.assertFalse(discover_link('https://www.city.kochi.kochi.jp/soshiki/117/news.html','職員紹介'))
 def test_discovery_not_starved_by_existing_records(self):
  from crawl import balanced_queue
  existing=[('known'+str(i),0) for i in range(100)]
  result=list(balanced_queue(existing,[('seed',0)],[('pending',1)],{}))
  self.assertIn(('seed',0),result[:4]);self.assertIn(('pending',1),result[:4])
  self.assertEqual(len(result),102)
 def test_oldest_seed_and_known_are_prioritized(self):
  from crawl import balanced_queue
  q=list(balanced_queue([('new',0),('old',0)],[('fresh-seed',0)],[('unseen',1)],{'new':{'fetched_at':'2026-10-29'},'old':{'fetched_at':'2026-10-01'},'fresh-seed':{'fetched_at':'2026-10-29'}}))
  self.assertEqual(q[:2],[('unseen',1),('old',0)])

class CollectionSchedulingTests(unittest.TestCase):
 def test_candidate_not_buried_in_department_backlog(self):
  from crawl import next_page
  from collections import deque
  root='https://www.city.kochi.kochi.jp/'
  target=root+'soshiki/58/burokku.html';known=root+'known'
  queue=deque([(root+'soshiki/'+str(i)+'/',1) for i in range(100)]+[(target,2),(known,0)])
  registry={target:{'link_title':'ブロック塀等の耐震対策の補助制度'}}
  self.assertEqual(next_page(queue,registry,{known},0)[0][0],target)
  self.assertEqual(next_page(queue,registry,{known},1)[1],1)
  self.assertEqual(next_page(queue,registry,{known},2)[0][0],known)
 def test_discovery_does_not_claim_fetch_success(self):
  from crawl import remember_links,coverage_report
  registry={};url='https://www.city.kochi.kochi.jp/soshiki/58/burokku.html'
  remember_links('https://www.city.kochi.kochi.jp/soshiki/58/',[(url,'ブロック塀等の耐震対策の補助制度')],registry)
  self.assertNotIn('fetched_at',registry[url]);self.assertEqual(coverage_report(registry,{})['unresolved'][0]['state'],'not_fetched')
 def test_department_to_program_full_collection(self):
  import tempfile,json
  from unittest.mock import patch
  import crawl
  origin='https://www.city.kochi.kochi.jp';index=origin+'/soshiki/58/';target=origin+'/soshiki/58/burokku.html'
  docs={index:'<h1>建築指導課</h1><div id="main_body"><a href="burokku.html">ブロック塀等の耐震対策の補助制度</a></div>',target:'<h1>ブロック塀等の耐震対策の補助制度</h1><div class="date">更新日：2023年8月30日</div><div id="main_body"><p>令和8年度は令和8年4月1日から申請を受け付けています。</p></div>'}
  class FakeFetcher:
   def __init__(self,**kwargs):self.status={}
   def prepare(self,src):self.status[src['id']]={'state':'ready'};return True
   def get(self,url):return docs[url].encode(),'utf-8'
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory)
   with patch.object(crawl,'ROOT',root),patch.object(crawl,'Fetcher',FakeFetcher),patch.object(crawl,'SOURCES',[{**crawl.SOURCES[0],'seeds':['/soshiki/58/']}]),patch.object(sys,'argv',['crawl','--max-pages','2','--per-source','2','--delay','0']):crawl.main()
   catalog=json.loads((root/'data/catalog.json').read_text())
   self.assertEqual([r['url'] for r in catalog['records']],[target])
   self.assertEqual(catalog['records'][0]['review_state'],'pending')
   self.assertEqual(json.loads((root/'data/coverage.json').read_text())['unresolved_count'],0)

class ProgramBoundaryTests(unittest.TestCase):
 def test_reporting_forms_are_not_new_schemes(self):
  from crawl import is_candidate
  self.assertFalse(is_candidate('令和7年度までに認定を受けた木造除却補助金の提出書類（様式）','https://www.city.kochi.kochi.jp/soshiki/58/mokujo7nenndo.html'))
 def test_report_deadline_is_not_used_as_application_end(self):
  import json
  path=Path(__file__).resolve().parents[1]/'data/reviews.json'
  review=next((r for r in json.loads(path.read_text()).values() if r.get('title')=='ブロック塀等の耐震対策の補助制度'),None)
  self.assertIsNotNone(review)
  self.assertFalse(any(r.get('end') for r in review['rounds']))
  self.assertEqual(review['deadlines'][0]['label'],'実績報告の提出期限')
