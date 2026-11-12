from pathlib import Path
import json,re,html,shutil,os
from datetime import datetime,timezone
from zoneinfo import ZoneInfo
from sources import SOURCES,source_meta
ROOT=Path(__file__).resolve().parents[1];DIST=ROOT/'dist'
def e(s):return html.escape(str(s or ''))
def local_date(value):
 if not value:return None
 try:return datetime.fromisoformat(value.replace('Z','+00:00')).astimezone(ZoneInfo('Asia/Tokyo')).strftime('%Y年%m月%d日 %H:%M（日本時間）')
 except ValueError:return value
def base_path():
 value=os.environ.get('BASE_PATH','').strip('/')
 if value and (not re.fullmatch(r'[A-Za-z0-9_./-]+',value) or '..' in value.split('/')):
  raise ValueError('BASE_PATH must be a safe URL path')
 return '/'+value if value else ''

def prefix_html(text,base):
 return re.sub(r'((?:href|src)=["\'])(/)(?!/)',lambda m:m[1]+base+'/',text)

def main():
 base=base_path()
 DIST.mkdir(exist_ok=True)
 for path in (ROOT/'web').rglob('*'):
  if not path.is_file():continue
  target=DIST/path.relative_to(ROOT/'web');target.parent.mkdir(parents=True,exist_ok=True)
  if path.suffix=='.html':target.write_text(prefix_html(path.read_text(),base))
  else:shutil.copy2(path,target)
 catalog=json.loads((ROOT/'data/catalog.json').read_text());run=json.loads((ROOT/'data/last-run.json').read_text());reviews=json.loads((ROOT/'data/reviews.json').read_text()) if (ROOT/'data/reviews.json').exists() else {}
 exclusions=json.loads((ROOT/'data/exclusions.json').read_text()) if (ROOT/'data/exclusions.json').exists() else {}
 pdfdata=json.loads((ROOT/'data/pdf-registry.json').read_text()) if (ROOT/'data/pdf-registry.json').exists() else {}
 shutil.rmtree(DIST/'support',ignore_errors=True)
 records=[]
 for original in catalog['records']:
  r={**original,**source_meta(original['url'])}
  if r['id'] in exclusions:continue
  review=reviews.get(r['id'])
  pdf_changed=any(pdfdata.get(a['url'],{}).get('content_changed_at','')>(review or {}).get('checked_at','') for a in r.get('pdfs',[]))
  if review and review.get('source_hash')==r['hash'] and not pdf_changed:
   r.update({k:v for k,v in review.items() if k not in ['source_hash']});r['review_state']='reviewed'
  else:r['review_state']='structured' if original.get('data_kind')=='api' else 'pending'
  r['source_date']='-'.join(x.zfill(2) for x in re.findall(r'\d+',r.get('source_updated_at') or '')[:3])
  r.update(source_meta(r['url']))
  records.append(r)
  dest=DIST/'support'/r['id'];dest.mkdir(parents=True,exist_ok=True)
  title=e(r['title']);evidence=r.get('evidence') or []
  rounds=''.join('<li>'+e(x.get('label','募集'))+'：'+e((x.get('start_label') or local_date(x.get('start')) or '開始時期は公式案内参照')+' ～ '+(x.get('end_label') or local_date(x.get('end')) or '終了時期は公式案内参照'))+'</li>' for x in r.get('rounds',[]))
  deadlines=''.join('<li>'+e(x.get('label'))+'：'+e(x.get('date'))+'</li>' for x in r.get('deadlines',[]))
  attachments=''.join(f'<li><a href="{e(x["url"])}" target="_blank" rel="noopener">{e(x["title"])}</a></li>' for x in r.get('pdfs',[])[:12])
  evidencehtml=''.join('<li>'+e(x.get('field',''))+'：'+e(x.get('quote',''))+'</li>' for x in evidence)
  extraction=r.get('html_extraction',{})
  sections=extraction.get('sections',[]) if extraction.get('source_hash')==r['hash'] and r['review_state']!='reviewed' else []
  support_html = ('<p>公式ページから自動抽出した内容です。人による内容確認は未実施です。</p>' + ''.join('<h3>'+e(s['heading'])+'</h3><p class="source-excerpt">'+e(s['text'])+'</p>' for s in sections)) if sections else ('<p>'+e(r.get('amount') or '本文から支援内容を自動抽出できていません。公式ページをご確認ください。')+'</p><p>対象地域：'+e(r.get('target_area') or '公式案内をご確認ください')+'</p><p>'+e(r.get('eligibility') or '本文から対象者を自動抽出できていません。公式ページをご確認ください。')+'</p>')
  detail=f'''<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{title}｜こうち支援ナビ</title><link rel="stylesheet" href="/style.css"></head><body><header class="header"><a class="brand" href="/">こうち支援ナビ</a><a href="/">← 制度を探す</a></header><main class="detail"><div class="detail-meta"><span class="authority {e(r['source_id'])}">{e(r['source_level'])}</span><span>掲載元：{e(r['source_name'])}</span></div><span class="category">{e(' / '.join(r['purposes']))}</span><h1>{title}</h1><p>{e(r['summary'])}</p><section><h2>支援内容・対象者</h2>{support_html}</section><section><h2>募集・申請について</h2><p id="status">確認日時点の受付状況は公式ページをご確認ください。</p><ul>{rounds}</ul>{('<h3>手続きごとの期限</h3><ul>'+deadlines+'</ul>') if deadlines else ''}<p>予算到達や条件変更により、受付状況が変わる場合があります。エントリーと正式申請は異なる場合があります。</p><p><a class="source-link" href="{e(r['url'])}" target="_blank" rel="noopener">{e(r['source_name'])}の公式ページで確認する ↗</a></p></section><section><h2>出典と確認状況</h2><p>掲載元の区分：{e(r['source_level'])} ／ {e(r['source_name'])}</p><p>制度の実施主体：{e(r.get('issuer_name') or '未確認（掲載元と実施主体は異なる場合があります）')}</p><p>公式ページの表記：{e(r.get('source_updated_at') or '記載を確認できていません')}</p><p>ページ取得：{e(r.get('fetched_at') or '公式本文の取得未完了')}</p><p>取得方式：{e({'api':'公式API','rss':'公式RSS'}.get(r.get('data_kind'),'公式HTML'))}</p><p>内容確認：{e(r.get('checked_at') or '未確認')}</p><p>確認範囲：{e(r.get('review_scope') or '制度候補の発見まで。内容条件は確認中です。')}</p><ul>{evidencehtml}</ul>{('<p>出典：Jグランツ。jGrantsのWeb-APIから取得した情報を編集・加工して掲載しています。内容は日本国政府及び自治体が保証するものではありません。</p>' if r.get('data_kind')=='api' else '')}<h2>関連する公式資料</h2><ul>{attachments or '<li>このページに登録済みのPDFはありません。</li>'}</ul></section></main><script type="module">import{{statusOf}}from'{base}/core.mjs';const r={json.dumps({k:r.get(k) for k in ['title','review_state','closed','rounds','continuous']},ensure_ascii=False).replace('<',chr(92)+'u003c')};const paint=()=>document.querySelector('#status').textContent=statusOf(r);paint();setInterval(paint,60000);</script></body></html>'''
  (dest/'index.html').write_text(prefix_html(detail,base))
 source_status_path=ROOT/'data/source-status.json'
 source_status=json.loads(source_status_path.read_text()) if source_status_path.exists() else {}
 coverage=json.loads((ROOT/'data/coverage.json').read_text()) if (ROOT/'data/coverage.json').exists() else {}
 pdf_urls={a['url'] for r in catalog['records'] for a in r.get('pdfs',[])}
 pdf_status={'attempted':sum(v.get('fetched_at','')>run['started_at'] or v.get('failed_at','')>run['started_at'] for v in pdfdata.values()),'succeeded':sum(v.get('fetched_at','')>run['started_at'] for v in pdfdata.values()),'errors':[{'url':u,'error':v.get('error')} for u,v in pdfdata.items() if v.get('failed_at','')>run['started_at']],'pending':sum(not pdfdata.get(u,{}).get('fetched_at') for u in pdf_urls),'scope':'登録済みPDFリンクの一部。全PDFの確認は未完了。'}
 pdf_status['ocr_required']=sum(v.get('state')=='ocr_required' for v in pdfdata.values())
 public={'pdf_status':pdf_status,'coverage':{'unresolved_count':coverage.get('unresolved_count',0),'generated_at':coverage.get('generated_at')},'structured_run':json.loads((ROOT/'data/structured-run.json').read_text()) if (ROOT/'data/structured-run.json').exists() else {},'sources':[{k:s[k] for k in ['id','name','level','origin','homepage_url'] if k in s}|({'path_prefix':s['path_prefix']} if s.get('path_prefix') else {}) for s in SOURCES],'source_status':source_status,'generated_at':catalog['generated_at'],'scope':catalog['scope'],'run':{'visited':run['visited'],'total_records':len(records),'errors':len(run['errors']),'finished_at':run['finished_at']},'records':records}
 (DIST/'data.json').write_text(json.dumps(public,ensure_ascii=False))
 (DIST/'all').mkdir(exist_ok=True)
 (DIST/'all/index.html').write_text('<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>制度一覧｜こうち支援ナビ</title><link rel="stylesheet" href="/style.css"><main class="detail"><a href="/">検索へ戻る</a><h1>掲載制度一覧</h1><p>収集試行中です。全件の掲載は確認できていません。</p><ul>'+''.join(f'<li><a href="/support/{r["id"]}/">[{e(r['source_level'])}・{e(r['source_name'])}] {e(r["title"])}</a></li>' for r in records)+'</ul></main></html>')
 # Prefix the generated listing as well as template pages.
 listing=DIST/'all/index.html';listing.write_text(prefix_html(listing.read_text(),base))
 (DIST/'.nojekyll').touch()
 (DIST/'robots.txt').write_text('User-agent: *\nDisallow: /\n')
 print(json.dumps({'published_records':len(records),'reviewed':sum(r['review_state']=='reviewed' for r in records),'generated_at':public['generated_at']},ensure_ascii=False))
if __name__=='__main__':main()
