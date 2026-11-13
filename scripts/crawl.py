"""Bounded daily collection with independent budgets, robots rules and status per source."""
from __future__ import annotations
import argparse,hashlib,json,re,time,unicodedata
from collections import deque
from pathlib import Path
from datetime import datetime,timezone
from urllib.parse import urljoin,urlsplit
from bs4 import BeautifulSoup
from extract_html import VERSION, apply_extraction
from sources import SOURCES,Fetcher,canonical,source_for,source_meta,safe_url
ROOT=Path(__file__).resolve().parents[1]
ORIGIN=SOURCES[0]['origin'];SEEDS=SOURCES[0]['seeds']
TERMS=re.compile(r'補助金|助成金|給付金|支援金|奨励金|交付金|貸付|融資|利子補給|負担軽減|手当|医療費助成|就学援助|補助制度|助成制度|費用助成|補助事業|診断費補助')
EXCLUDE=re.compile(r'提出書類[（(]様式|財産処分|交付要綱等の公表|交付状況|抽選結果|交付決定について|報告について|様式について|注意事項|実績報告|募集結果|選定結果|要綱の.*改正|要綱の制定')
def now():return datetime.now(timezone.utc).isoformat()
def write(path,obj):
 path.parent.mkdir(parents=True,exist_ok=True);tmp=path.with_suffix('.tmp');tmp.write_text(json.dumps(obj,ensure_ascii=False,indent=2));tmp.replace(path)
def read(name,default):
 p=ROOT/'data'/name;return json.loads(p.read_text()) if p.exists() else default
def classify(title):
 rules=[('子育て・教育',r'子ども|子育て|児童|保育|就学|教育|ひとり親|母子'),('住まい',r'住宅|住まい|家賃|空き家|耐震|除却|解体|ブロック塀|移住|定住|ターン'),('省エネ・環境',r'太陽光|蓄電|省エネ|高効率|環境|浄化槽|木材|生ごみ'),('創業・事業支援',r'企業|事業者|創業|設備導入|商店|商業|経営|店舗'),('健康・福祉',r'医療|障害|障がい|高齢|介護|福祉|健康|結核'),('農林水産',r'農業|農地|林業|漁業|水産|農林'),('地域・防災',r'地域|町内|自治会|防災|災害|コミュニティ|耐震|ブロック塀')]
 purposes=[label for label,pat in rules if re.search(pat,title)] or ['その他']
 audiences=[]
 if re.search('企業|事業者|創業|設備導入|商店|商業|経営|店舗',title):audiences.append('事業者')
 if re.search('農業|農地|林業|漁業|水産|農林',title):audiences.extend(['事業者','農林水産業者'])
 if re.search('町内|自治会|団体|コミュニティ',title):audiences.append('地域団体')
 if re.search('子ども|子育て|児童|保育|就学|ひとり親|母子',title):audiences.extend(['個人・世帯','子育て世帯'])
 if re.search('住宅|医療|高齢|障がい|障害|家賃|生ごみ|移住|定住|ターン',title):audiences.append('個人・世帯')
 return sorted(set(audiences)) or ['対象者を確認'],purposes


def parse_page(url,html):
 soup=BeautifulSoup(html,'html.parser');src=source_for(url)
 h=soup.select_one('#pageTitle h1') or soup.select_one('#main_header h1')
 if not h:h=next((x for x in soup.select('h1') if x.get_text(' ',strip=True)),None)
 if not h:h=next((x for x in soup.select('h2') if TERMS.search(x.get_text(' ',strip=True))),None)
 title=h.get_text(' ',strip=True) if h else (soup.title.get_text(' ',strip=True) if soup.title else '')
 body=next((soup.select_one(sel) for sel in (src or {}).get('selectors',['main']) if soup.select_one(sel)),None) or soup
 updated=soup.select_one('#content_header .date') or soup.select_one('.date .updated') or soup.select_one('.date') or soup.select_one('time')
 updated=updated.get_text(' ',strip=True) if updated else None
 if not updated and (match:=re.search(r'最終更新日[：:]?\s*(\d{4}年\d{1,2}月\d{1,2}日)',soup.get_text(' ',strip=True))):updated='更新日：'+match.group(1)
 if updated and (match:=re.search(r'更新日\s*(\d{4}年\d{1,2}月\d{1,2}日)',unicodedata.normalize('NFKC',updated))):updated='更新日：'+match.group(1)
 for el in body.select('script,style,nav,header,footer'):el.decompose()
 text=body.get_text('\n',strip=True)
 links=[];attachments=[]
 for a in body.select('a[href]'):
  full=urljoin(url,a['href']);label=a.get_text(' ',strip=True)
  link=canonical(full)
  if link:links.append((link,label))
  if re.search(r'\.pdf(?:$|\?)',full,re.I) and safe_url(full):attachments.append({'url':safe_url(full),'title':label})
 return title,text,links,attachments,updated

def is_aggregate(title,url):
 return bool(re.fullmatch(r'令和[0-9０-９]+年度補助金情報',title)) or title in ['補助金・助成金','助成金','補助金公募情報','補助金の公募・採択','支援策チラシ一覧','助成金・補助金'] or title.endswith('補助金一覧') or '/category/' in url

def is_candidate(title,url):
 return bool(TERMS.search(title)) and not EXCLUDE.search(title) and not is_aggregate(title,url)

def discover_link(url,label):
 # Department and classification indexes must be traversed even without grant terms.
 return bool(TERMS.search(label) or re.search('支援|補助|助成|募集|移住|定住|制度',label) or re.fullmatch(r'/soshiki/(?:[0-9]+/|$)',urlsplit(url).path) or re.fullmatch(r'/life/(?:[0-9]+/)+',urlsplit(url).path))

def balanced_queue(existing,seeds,pending,registry):
 # Reserve alternating slots for discovery and oldest known records. No starvation.
 known=deque(sorted(existing,key=lambda item:registry.get(item[0],{}).get('fetched_at','')))
 discovery=deque(sorted(seeds+pending,key=lambda item:registry.get(item[0],{}).get('fetched_at','')))
 result=[];added=set()
 while known or discovery:
  for queue in (discovery,known):
   while queue:
    item=queue.popleft()
    if item[0] not in added:
     added.add(item[0]);result.append(item);break
 return deque(result)

def remember_links(parent,links,registry):
 for url,label in links:
  if not discover_link(url,label):continue
  entry=registry.setdefault(url,{**source_meta(url),'state':'queued'})
  entry.setdefault('discovered_from',parent);entry.setdefault('discovered_at',now())
  if label:entry['link_title']=label

def next_page(queue,registry,known,turn,versions=None):
 # Three reserved lanes: unfetched program candidates, discovery, existing programs.
 def lane(item):
  url=item[0];entry=registry.get(url,{})
  if url in known:return 2
  if not entry.get('fetched_at') and is_candidate(entry.get('link_title',''),url):return 0
  return 1
 for offset in range(3):
  target=(turn+offset)%3
  items=[item for item in queue if lane(item)==target]
  if items:
   chosen=min(items,key=lambda item:((versions or {}).get(item[0],0)>=VERSION if target==2 else False,registry.get(item[0],{}).get('fetched_at') or registry.get(item[0],{}).get('failed_at') or ''))
   queue.remove(chosen);return chosen,target
 raise IndexError('empty crawl queue')

def coverage_report(registry,records):
 published={r['url'] for r in records.values()};missing=[]
 for url,entry in registry.items():
  if is_candidate(entry.get('link_title',''),url) and url not in published:
   missing.append({'url':url,'title':entry['link_title'],'discovered_from':entry.get('discovered_from'),'fetched_at':entry.get('fetched_at'),'state':'fetch_failed' if entry.get('last_error') else 'fetched_not_listed' if entry.get('fetched_at') else 'not_fetched','error':entry.get('last_error')})
 return {'generated_at':now(),'unresolved_count':len(missing),'unresolved':missing}

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--max-pages',type=int,default=160);ap.add_argument('--per-source',type=int,default=40);ap.add_argument('--time-budget',type=float,default=600);ap.add_argument('--delay',type=float,default=1.5);ap.add_argument('--resume',action='store_true');ap.add_argument('--sources',default=','.join(s['id'] for s in SOURCES));args=ap.parse_args()
 selected=[s for s in SOURCES if s.get('transport','html')=='html' and s['id'] in args.sources.split(',')]
 if not selected:ap.error('unknown source selection')
 raw=ROOT/'private/snapshots';raw.mkdir(parents=True,exist_ok=True)
 catalog=read('catalog.json',{'records':[]});previous={r['id']:r for r in catalog['records']};records={k:{**r,**source_meta(r['url'])} for k,r in previous.items()}
 registry=read('registry.json',{});frontier=read('frontier.json',[]);fetcher=Fetcher(delay=args.delay);queues={};source_runs={};seen=set();failed=[];start=time.monotonic()
 # Recover discovery labels for queues created by older versions, without network calls.
 for parent in list(registry):
  snapshot=raw/(hashlib.sha256(parent.encode()).hexdigest()[:16]+'.html')
  if snapshot.exists():remember_links(parent,parse_page(parent,snapshot.read_text())[2],registry)
 known={r['url'] for r in previous.values()}
 versions={r['url']:(r.get('html_extraction') or {}).get('version',0) for r in previous.values()}
 run={'started_at':now(),'visited':0,'candidates':0,'errors':[],'changed':[],'new':[],'scope':'高知市・高知県・中小企業庁・高知県産業振興センター・高知商工会議所の登録した巡回元。全件収集は確認中。','sources':source_runs}
 for src in selected:
  sid=src['id'];existing=[(r['url'],0) for r in previous.values() if source_meta(r['url'])['source_id']==sid];pending=[(u,d) for u,d in frontier if source_meta(u)['source_id']==sid]
  seeds=[(src['origin']+p,0) for p in src['seeds']]
  queues[sid]=balanced_queue(existing,seeds,pending,registry)
  source_runs[sid]={'name':src['name'],'level':src['level'],'attempted':0,'visited':0,'candidates':0,'started_at':now(),'lane_counts':{'new_candidate':0,'discovery':0,'existing':0}}
  ready=fetcher.prepare(src);source_runs[sid].update(fetcher.status[sid])
  if not ready:run['errors'].append({'source_id':sid,'url':src['origin']+'/robots.txt','error':fetcher.status[sid].get('error')})
 def checkpoint():
  stamp=now();run['finished_at']=stamp;run['attempted']=sum(x['attempted'] for x in source_runs.values());run['total_records']=len(records)
  run['remaining_queue']=sum(len(q) for q in queues.values())
  write(ROOT/'data/catalog.json',{'generated_at':stamp,'scope':run['scope'],'records':list(records.values())});write(ROOT/'data/registry.json',registry)
  write(ROOT/'data/last-run.json',run)
  write(ROOT/'data/coverage.json',coverage_report(registry,records))
  previous_status=read('source-status.json',{});previous_status.update({sid:{**value,'checked_at':stamp} for sid,value in source_runs.items()});write(ROOT/'data/source-status.json',previous_status)
  # Keep unselected queues and keep failed pages for another run.
  todo=[(u,d) for u,d in frontier if source_meta(u)['source_id'] not in queues]
  todo.extend(failed);todo.extend((u,d) for q in queues.values() for u,d in q if u not in seen);write(ROOT/'data/frontier.json',todo)
 try:
  active=True
  while active and sum(x['attempted'] for x in source_runs.values())<args.max_pages and time.monotonic()-start<args.time_budget:
   active=False
   for src in selected:
    sid=src['id'];stat=source_runs[sid];q=queues[sid]
    if stat['attempted']>=args.per_source or stat.get('state')=='unavailable':continue
    while q and (not canonical(q[0][0]) or canonical(q[0][0]) in seen):q.popleft()
    if not q:continue
    active=True
    if sum(x['attempted'] for x in source_runs.values())>=args.max_pages or time.monotonic()-start>=args.time_budget:break
    (url,depth),lane=next_page(q,registry,known,stat['attempted']%3,versions);url=canonical(url);seen.add(url);stat['attempted']+=1
    stat['lane_counts'][('new_candidate','discovery','existing')[lane]]+=1
    try:
     blob,charset=fetcher.get(url);html=str(BeautifulSoup(blob,'html.parser',from_encoding=charset));title,text,links,pdfs,updated=parse_page(url,html)
     digest=hashlib.sha256(text.encode()).hexdigest();key=hashlib.sha256(url.encode()).hexdigest()[:16];(raw/(key+'.html')).write_text(html)
     stat['visited']+=1;run['visited']+=1
     candidate=is_candidate(title,url)
     registry[url]={**{k:v for k,v in registry.get(url,{}).items() if k in ('link_title','discovered_from','discovered_at')},'title':title,'state':'candidate' if candidate else 'discovery','reason':'制度候補語を検出' if candidate else '発見元または対象外','fetched_at':now(),'hash':digest,'pdfs':pdfs,**source_meta(url)}
     if candidate:
      audiences,purposes=classify(title)
      if src['default_audiences'] and audiences==['対象者を確認']:audiences=src['default_audiences']
      old=previous.get(key)
      r={'id':key,'url':url,'title':title,'audiences':audiences,'purposes':purposes,'source_updated_at':updated,'fetched_at':now(),'hash':digest,'pdfs':pdfs,'review_state':'pending','retrieval_state':'fetched','summary':'制度の詳細条件は掲載元の公式ページをご確認ください。','amount':None,'eligibility':None,'rounds':[],'evidence':[],'checked_at':None,'issuer_level':None,'issuer_name':None,**source_meta(url)}
      if old and old.get('hash')==digest:r.update({k:old[k] for k in ['review_state','summary','amount','eligibility','rounds','evidence','checked_at','issuer_level','issuer_name'] if k in old})
      if old and old.get('hash')!=digest:run['changed'].append(key)
      if not old:run['new'].append(key)
      apply_extraction(r,html)
      registry[url]['html_extraction_version']=VERSION
      records[key]=r;run['candidates']+=1;stat['candidates']+=1
     remember_links(url,links,registry)
     if depth<3:
      for u,label in links:
       target=source_for(u)
       if target and target['id'] in queues and discover_link(u,label) and u not in seen and not any(v[0]==u for v in queues[target['id']]):queues[target['id']].append((u,depth+1))
     print(f"{sid} {stat['visited']} {title[:65]}",flush=True)
    except Exception as ex:
     run['errors'].append({'source_id':sid,'url':url,'error':str(ex)[:180]});registry[url]={**registry.get(url,{}),'last_error':str(ex)[:180],'failed_at':now(),**source_meta(url)}
     failed.append((url,depth))
     print(f'{sid} ERROR {url} {str(ex)[:80]}',flush=True)
    checkpoint()
   if (ROOT/'private/stop-crawl').exists():break
 finally:checkpoint()
 print(json.dumps({'visited':run['visited'],'candidates':run['candidates'],'source_runs':source_runs},ensure_ascii=False))
if __name__=='__main__':main()
