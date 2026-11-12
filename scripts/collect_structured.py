"""Official public JSON API and RSS adapters. No HTML access or proxy fallback."""
import argparse,hashlib,json,re,time,urllib.request,urllib.parse,xml.etree.ElementTree as ET
from datetime import datetime,timezone,timedelta
from bs4 import BeautifulSoup
from sources import ROOT,source_meta
from crawl import read,write,classify,now
API='https://api.jgrants-portal.go.jp/exp'
FEED='https://j-net21.smrj.go.jp/snavi/support/support.xml'
NS={'dc':'http://purl.org/dc/elements/1.1/','rdf':'http://www.w3.org/1999/02/22-rdf-syntax-ns#'}
def plain(value):return BeautifulSoup(str(value or ''),'html.parser').get_text(' ',strip=True)
def relevant(area):return bool(set(re.split(r'\s*/\s*',area or '')) & {'全国','高知県','四国地方'})
def digest(obj):return hashlib.sha256(json.dumps(obj,ensure_ascii=False,sort_keys=True).encode()).hexdigest()
def valid_date(value):
 if not value:return None
 try:return datetime.fromisoformat(value.replace('Z','+00:00')) if datetime.fromisoformat(value.replace('Z','+00:00')).tzinfo else None
 except (ValueError,TypeError):return None
class Redirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,req,fp,code,msg,headers,newurl):
  p=urllib.parse.urlsplit(newurl)
  if p.scheme!='https' or p.hostname!=urllib.parse.urlsplit(req.full_url).hostname:raise ValueError('unexpected structured-source redirect')
  return super().redirect_request(req,fp,code,msg,headers,newurl)
def fetch(url,limit=30_000_000):
 p=urllib.parse.urlsplit(url)
 if p.scheme!='https' or p.hostname not in {'api.jgrants-portal.go.jp','j-net21.smrj.go.jp'} or p.username or p.password:raise ValueError('outside structured-source allowlist')
 with urllib.request.build_opener(Redirect()).open(urllib.request.Request(url,headers={'User-Agent':'KochiSupportIndex/0.3 (official public API/RSS client)','Accept':'application/json, application/xml, text/xml'}),timeout=30) as r:
  data=r.read(limit+1)
  if len(data)>limit:raise ValueError('response size limit')
 return data
def api_record(d,stamp):
 if not re.fullmatch(r'[A-Za-z0-9]{15,18}',d.get('id','')):raise ValueError('invalid subsidy ID')
 url='https://www.jgrants-portal.go.jp/subsidy/'+d['id'];title=plain(d.get('title'))
 if not title:raise ValueError('missing title')
 workflows=d.get('workflow')
 if not isinstance(workflows,list):raise ValueError('missing workflow list')
 applicable=[w for w in workflows if relevant(w.get('target_area_search'))]
 if not applicable:return None
 rounds=[]
 for w in applicable:
  start,end=w.get('acceptance_start_datetime'),w.get('acceptance_end_datetime')
  if start and not valid_date(start) or end and not valid_date(end):raise ValueError('invalid acceptance date')
  rounds.append({'label':plain(w.get('fiscal_year_round')) or 'API掲載の募集回','start':start,'end':end,'confirmed_open':bool(start and end) and not re.search('交付申請|共同申請者|事前着手|実績報告|精算払|遂行状況',title)})
 cap=d.get('subsidy_max_limit');rate=plain(d.get('subsidy_rate'));amount=[]
 if isinstance(cap,(int,float)) and not isinstance(cap,bool) and cap>0:amount.append('上限 '+format(cap,',')+'円')
 if rate:amount.append('補助率 '+rate)
 _,purposes=classify(title+' '+plain(d.get('use_purpose')))
 normalized={k:v for k,v in d.items() if k not in ('application_guidelines','outline_of_grant','application_form')}
 # API's institution_name means scheme name, not implementing organization.
 return {'id':'jg-'+d['id'],'external_id':d['id'],'url':url,'title':title,'hash':digest(normalized),'fetched_at':stamp,'source_updated_at':None,'source_id':'jgrants','source_name':'Jグランツ（デジタル庁）','source_level':'国','retrieval_state':'fetched','data_kind':'api','review_state':'structured','checked_at':None,'review_scope':'公式APIの構造化項目を自動取得。対象資格・加算条件・公募要領の全文は未確認。受付状況はAPIの募集期間に基づきます。','summary':plain(d.get('subsidy_catch_phrase') or d.get('detail'))[:450] or '詳細は公式の募集情報をご確認ください。','amount':' ／ '.join(amount) or None,'eligibility':plain(d.get('target_number_of_employees')) or None,'target_area':' / '.join(dict.fromkeys(w['target_area_search'] for w in applicable)),'audiences':['対象者を確認'],'purposes':purposes,'keywords':[plain(d.get('use_purpose')),plain(d.get('industry')),plain(d.get('institution_name'))],'issuer_name':None,'issuer_level':None,'rounds':rounds,'pdfs':[],'evidence':[],'api_url':API+'/v2/public/subsidies/id/'+d['id']}
def summary_record(d,stamp):
 r=api_record({**d,'workflow':[d]},stamp)
 if r:
  for w in r['rounds']:w['confirmed_open']=False
  r.update(data_detail='summary',list_hash=digest(d),last_listed_at=stamp,summary='公式APIの一覧情報を取得しました。制度の概要・詳細条件は公式ページをご確認ください。',review_scope='公式APIの一覧項目（名称・対象地域・上限額・受付期間）を自動取得。概要・補助率・対象資格・公募要領は未確認。')
 return r

def rss_records(blob,stamp):
 if b'<!DOCTYPE' in blob.upper() or b'<!ENTITY' in blob.upper():raise ValueError('DTD/entity not accepted')
 root=ET.fromstring(blob);items=root.findall('./channel/item');out=[]
 if root.tag!='rss':raise ValueError('unexpected RSS root')
 for item in items:
  areas=[x.text or '' for x in item.findall('dc:coverage/rdf:label',NS)];codes=[x.text or '' for x in item.findall('dc:coverage/rdf:value',NS)]
  if not relevant(' / '.join(areas)) and 'JP-39' not in codes:continue
  title=plain(item.findtext('title'));url=item.findtext('link') or '';p=urllib.parse.urlsplit(url)
  if p.scheme!='https' or p.hostname!='j-net21.smrj.go.jp' or not re.fullmatch(r'/snavi(?:2)?/articles/\d+',p.path):continue
  if not re.search('補助金|助成金|給付金|支援金|奨励金',title):continue
  audiences,purposes=classify(title)
  out.append({'id':'jn-'+hashlib.sha256(url.encode()).hexdigest()[:16],'url':url,'title':title,'hash':digest(ET.tostring(item,encoding='unicode')),'summary':plain(item.findtext('description'))[:650],'source_updated_at':item.findtext('dc:date',namespaces=NS),'fetched_at':stamp,'data_kind':'rss','review_state':'pending','checked_at':None,'review_scope':'公式RSSの見出し・概要・地域情報を取得。詳細条件は未確認。','target_area':' / '.join(areas),'amount':None,'eligibility':None,'audiences':['事業者'] if audiences==['対象者を確認'] else audiences,'purposes':purposes,'rounds':[],'pdfs':[],'evidence':[],'issuer_name':None,'issuer_level':None,**source_meta(url)})
 return out,len(items)
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--max-details',type=int,default=30);args=ap.parse_args()
 catalog=read('catalog.json',{'records':[]});records={r['id']:r for r in catalog['records']};statuses=read('source-status.json',{});run={'started_at':now(),'sources':{}};raw=ROOT/'private/structured';raw.mkdir(parents=True,exist_ok=True)
 def checkpoint():
  catalog.update(generated_at=now(),records=list(records.values()));write(ROOT/'data/catalog.json',catalog);write(ROOT/'data/source-status.json',statuses);write(ROOT/'data/structured-run.json',run)
 sid='jgrants';stat={'state':'ready','transport':'api','visited':0,'items':0,'errors':[],'checked_at':now()};statuses[sid]=stat;run['sources'][sid]=stat
 try:
  found={}
  for keyword in ['補助','助成','支援金','給付金']:
   # API requires a >=2-character keyword. Searches include past/future rounds.
   query=urllib.parse.urlencode({'keyword':keyword,'sort':'created_date','order':'DESC','acceptance':'0'})
   blob=fetch(API+'/v1/public/subsidies?'+query);j=json.loads(blob)
   if not isinstance(j.get('result'),list) or j.get('metadata',{}).get('resultset',{}).get('count')!=len(j['result']):raise ValueError('incomplete API list response')
   (raw/('list-'+keyword+'.json')).write_bytes(blob);stat['visited']+=1
   for d in j['result']:
    if relevant(d.get('target_area_search')):found[d['id']]=d
   time.sleep(1)
  threshold=datetime.now(timezone.utc)-timedelta(days=90)
  candidates=[d for d in found.values() if not valid_date(d.get('acceptance_end_datetime')) or valid_date(d['acceptance_end_datetime'])>=threshold or 'jg-'+d['id'] in records]
  for d in candidates:
   r=summary_record(d,now())
   if r:
    old=records.get(r['id'],{})
    if old.get('data_detail')=='full' and old.get('list_hash')==r['list_hash']:old['last_listed_at']=r['last_listed_at']
    else:records[r['id']]=r
  candidates.sort(key=lambda d:records.get('jg-'+d['id'],{}).get('api_detail_at',''))
  checkpoint()
  stat['listed_relevant']=len(found);stat['pending_details']=max(0,len(candidates)-args.max_details)
  for d in candidates[:args.max_details]:
   try:
    if not re.fullmatch(r'[A-Za-z0-9]{15,18}',d['id']):raise ValueError('invalid ID')
    blob=fetch(API+'/v2/public/subsidies/id/'+d['id']);j=json.loads(blob)
    if not isinstance(j.get('result'),list) or len(j['result'])!=1 or j['result'][0].get('id')!=d['id']:raise ValueError('invalid detail response')
    r=api_record(j['result'][0],now());(raw/(d['id']+'.json')).write_bytes(blob);stat['visited']+=1
    if r:r.update(data_detail='full',api_detail_at=r['fetched_at'],list_hash=digest(d),last_listed_at=r['fetched_at']);records[r['id']]=r;stat['items']+=1
    elif 'jg-'+d['id'] in records:del records['jg-'+d['id']] # verified region no longer relevant
   except Exception as ex:stat['errors'].append({'id':d['id'],'error':str(ex)[:180]})
   checkpoint();print('jgrants',stat['items'],d['title'],flush=True);time.sleep(1)
  stat['published_items']=sum(r.get('source_id')=='jgrants' for r in records.values())
  stat['pending_details']=sum(r.get('source_id')=='jgrants' and r.get('data_detail')!='full' for r in records.values())
  if stat['errors'] or stat['pending_details']:stat['state']='partial'
 except Exception as ex:stat.update(state='unavailable',error=str(ex)[:180])
 checkpoint()
 sid='jnet21';stat={'state':'ready','transport':'rss','visited':0,'items':0,'checked_at':now()};statuses[sid]=stat;run['sources'][sid]=stat
 try:
  blob=fetch(FEED,2_000_000);out,total=rss_records(blob,now());(raw/'jnet21.xml').write_bytes(blob)
  for r in out:
   if any(x['url']==r['url'] and x['id']!=r['id'] for x in records.values()):continue
   records[r['id']]=r
  stat.update(visited=1,feed_items=total,items=len(out),note='RSSは新着のみ。対象地域が全国・四国地方・高知県の補助金等を抽出。')
 except Exception as ex:stat.update(state='unavailable',error=str(ex)[:180])
 run['finished_at']=now();checkpoint();print(json.dumps(run,ensure_ascii=False),flush=True)
if __name__=='__main__':main()
