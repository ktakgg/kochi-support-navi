"""Collect evidence with the same source allowlist, throttling and robots rules as HTML."""
import argparse,hashlib,io,json
from pathlib import Path
from datetime import datetime,timezone
from pypdf import PdfReader
from sources import ROOT,SOURCES,Fetcher,source_for,source_meta
from crawl import write,read

def needs_ocr(text):
 # Unsupported Japanese PDF encodings can produce long but unreadable C1 text.
 return len(text.strip())<100 or sum('\x80'<=ch<='\x9f' for ch in text)>max(10,len(text)//50)

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--max-files',type=int,default=20);args=ap.parse_args()
 registry=read('registry.json',{});p=ROOT/'data/pdf-registry.json';old=read('pdf-registry.json',{});links={a['url']:a for r in registry.values() for a in r.get('pdfs',[]) if source_for(a['url'])}
 out=ROOT/'private/pdfs';out.mkdir(parents=True,exist_ok=True);fetcher=Fetcher();queues={s['id']:[] for s in SOURCES}
 for url in sorted(links,key=lambda u:old.get(u,{}).get('fetched_at','')):queues[source_for(url)['id']].append(url)
 done=0
 while done<args.max_files and any(queues.values()):
  for src in SOURCES:
   sid=src['id'];q=queues[sid]
   if not q or done>=args.max_files:continue
   if not fetcher.prepare(src):q.clear();continue
   url=q.pop(0);done+=1
   try:
    data,_=fetcher.get(url,12_000_000)
    if not data.startswith(b'%PDF'):raise ValueError('not PDF')
    digest=hashlib.sha256(data).hexdigest();key=hashlib.sha256(url.encode()).hexdigest()[:16];(out/(key+'.pdf')).write_bytes(data)
    reader=PdfReader(io.BytesIO(data));text='\n'.join(page.extract_text() or '' for page in reader.pages);(out/(key+'.txt')).write_text(text)
    changed=bool(old.get(url,{}).get('hash') and old[url]['hash']!=digest);stamp=datetime.now(timezone.utc).isoformat()
    old[url]={'content_changed_at':stamp if changed else old.get(url,{}).get('content_changed_at',''),'title':links[url]['title'],'hash':digest,'changed':changed,'pages':len(reader.pages),'text_length':len(text),'state':'ocr_required' if needs_ocr(text) else 'extracted','fetched_at':stamp,**source_meta(url)}
    print(sid,links[url]['title'],old[url]['state'],flush=True)
   except Exception as ex:old[url]={**old.get(url,{}),'error':str(ex)[:180],'failed_at':datetime.now(timezone.utc).isoformat(),**source_meta(url)}
   write(p,old)
if __name__=='__main__':main()
