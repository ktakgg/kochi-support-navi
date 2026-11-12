"""Recover metadata from downloaded snapshots if an initial crawl is interrupted."""
import hashlib,json
from datetime import datetime,timezone
from bs4 import BeautifulSoup
from crawl import ROOT,ORIGIN,SEEDS,canonical,parse_page,classify,TERMS,EXCLUDE,write,now
from urllib.parse import urljoin
files=list((ROOT/'private/snapshots').glob('*.html'));urls={ORIGIN+p for p in SEEDS}
for f in files:
 s=BeautifulSoup(f.read_text(),'html.parser')
 for a in s.select('a[href]'):
  u=canonical(urljoin(ORIGIN,a['href']))
  if u:urls.add(u)
lookup={hashlib.sha256(u.encode()).hexdigest()[:16]:u for u in urls}
records=[];registry={}
for f in files:
 url=lookup.get(f.stem)
 if not url:continue
 title,text,links,pdfs,updated=parse_page(url,f.read_text());digest=hashlib.sha256(text.encode()).hexdigest()
 registry[url]={'title':title,'fetched_at':datetime.fromtimestamp(f.stat().st_mtime,timezone.utc).isoformat(),'hash':digest,'pdfs':pdfs,'state':'discovery'}
 if TERMS.search(title) and not EXCLUDE.search(title) and title!='令和8年度補助金情報':
  a,p=classify(title);records.append({'id':f.stem,'url':url,'title':title,'audiences':a,'purposes':p,'source_updated_at':updated,'fetched_at':datetime.fromtimestamp(f.stat().st_mtime,timezone.utc).isoformat(),'hash':digest,'pdfs':pdfs,'review_state':'pending','summary':'制度の詳細条件は公式ページをご確認ください。','amount':None,'eligibility':None,'rounds':[],'evidence':[],'checked_at':None})
if not (ROOT/'data/catalog.json').exists():
 write(ROOT/'data/catalog.json',{'generated_at':now(),'scope':'初期収集の途中経過。','records':records});write(ROOT/'data/registry.json',registry);write(ROOT/'data/last-run.json',{'visited':len(files),'finished_at':now(),'errors':[],'checkpoint':True})
print('recovered',len(records))
