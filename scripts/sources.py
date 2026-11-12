"""Source identity is provenance, not proof of a program's implementing agency."""
import json,re,time,urllib.request,urllib.error,urllib.robotparser
from pathlib import Path
from urllib.parse import urlsplit,urlunsplit,urljoin
ROOT=Path(__file__).resolve().parents[1]
SOURCES=json.loads((ROOT/'data/sources.json').read_text())
UA='KochiSupportIndex/0.2 (+public-information-research; low-rate)'
def source_for(url):
 p=urlsplit(url)
 if p.username or p.password or p.port not in (None,443):return None
 return next((s for s in SOURCES if p.hostname in s['hosts']),None)
def safe_url(url):
 try:p=urlsplit(url);src=source_for(url)
 except ValueError:return None
 if p.scheme not in ('http','https') or not src:return None
 if src.get('path_prefix') and not p.path.startswith(src['path_prefix']) and p.path!='/robots.txt':return None
 scheme=urlsplit(src['origin']).scheme
 return urlunsplit((scheme,p.netloc,p.path or '/',p.query,''))
def canonical(url):
 url=safe_url(url)
 if not url:return None
 p=urlsplit(url)
 if p.query or re.search(r'\.(pdf|docx?|xlsx?|png|jpe?g|gif|svg|zip|xml|mp4|css|js)$',p.path,re.I):return None
 src=source_for(url)
 path=p.path if src.get('preserve_index') else re.sub(r'index\.html$','',p.path)
 if src.get('homepage_url') and path==src.get('path_prefix'):path=urlsplit(src['homepage_url']).path
 host=urlsplit(src['origin']).netloc
 return urlunsplit((p.scheme,host,path,'',''))
def source_meta(url):
 s=source_for(url)
 return {'source_id':s['id'],'source_level':s['level'],'source_name':s['name']} if s else {'source_id':'unknown','source_level':'未確認','source_name':'未確認'}
class SafeRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,req,fp,code,msg,headers,newurl):
  target=safe_url(newurl)
  if not target or source_for(req.full_url)['id']!=source_for(target)['id']:raise ValueError('redirect outside source allowlist')
  return super().redirect_request(req,fp,code,msg,headers,target)
class Fetcher:
 def __init__(self,delay=1.5,timeout=15):
  self.delay=delay;self.timeout=timeout;self.last={};self.robots={};self.status={};self.opener=urllib.request.build_opener(SafeRedirect())
 def raw(self,url,limit=8_000_000):
  u=safe_url(url)
  if not u:raise ValueError('outside source allowlist')
  host=urlsplit(u).hostname;time.sleep(max(0,self.delay-(time.monotonic()-self.last.get(host,0))));self.last[host]=time.monotonic()
  with self.opener.open(urllib.request.Request(u,headers={'User-Agent':UA}),timeout=self.timeout) as resp:
   data=resp.read(limit+1)
   if len(data)>limit:raise ValueError('document size limit exceeded')
   return data,resp.headers.get_content_charset()
 def prepare(self,source):
  sid=source['id']
  if sid in self.status:return self.status[sid]['state']=='ready'
  rp=urllib.robotparser.RobotFileParser()
  try:
   blob,_=self.raw(source['origin']+'/robots.txt');rp.parse(blob.decode('utf-8',errors='replace').splitlines());state={'state':'ready','robots':'取得済み'}
  except urllib.error.HTTPError as ex:
   if ex.code==404:rp.parse([]);state={'state':'ready','robots':'404（制限ファイルなし）'}
   else:state={'state':'unavailable','error':f'robots.txt HTTP {ex.code}'}
  except Exception as ex:state={'state':'unavailable','error':str(ex)[:180]}
  self.status[sid]=state;self.robots[sid]=rp
  return state['state']=='ready'
 def get(self,url,limit=8_000_000):
  source=source_for(url)
  if not source or not self.prepare(source):raise ValueError('source unavailable; robots could not be verified')
  if not self.robots[source['id']].can_fetch(UA,url):raise PermissionError('robots excluded')
  return self.raw(url,limit)
