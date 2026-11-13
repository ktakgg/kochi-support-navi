"""Re-extract HTML records; failed requests retain the entire previous record."""
import argparse, copy, hashlib
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from bs4 import BeautifulSoup
from crawl import ROOT, read, write, now, parse_page
from sources import Fetcher, source_for
from extract_html import VERSION, apply_extraction


def refresh_record(previous, fetcher, snapshot_dirs=()):
    url = previous['url']
    html = None
    for directory in snapshot_dirs:
        path = Path(directory) / (hashlib.sha256(url.encode()).hexdigest()[:16]+'.html')
        if path.is_file():
            cached = path.read_text()
            if hashlib.sha256(parse_page(url,cached)[1].encode()).hexdigest() == previous['hash']:
                html = cached
                break
    reused = html is not None
    if html is None:
        blob, charset = fetcher.get(url)
        html = str(BeautifulSoup(blob, 'html.parser', from_encoding=charset))
    soup = BeautifulSoup(html, 'html.parser')
    source = source_for(url) or {}
    if not any(soup.select_one(s) for s in source.get('selectors', ['main'])):
        raise ValueError('Official article container missing; previous record retained')
    title, text, links, pdfs, updated = parse_page(url, html)
    if not text.strip():
        raise ValueError('Empty official article; previous record retained')
    digest = hashlib.sha256(text.encode()).hexdigest()
    record = copy.deepcopy(previous)
    record.update(title=title, hash=digest, fetched_at=previous['fetched_at'] if reused else now(), source_updated_at=updated,
                  pdfs=pdfs, review_state='pending', retrieval_state='fetched', checked_at=None,
                  rounds=[], evidence=[], summary='制度の詳細条件は掲載元の公式ページをご確認ください。')
    apply_extraction(record, html)
    record['html_extraction']['reused_snapshot'] = reused
    raw = ROOT / 'private/snapshots'
    raw.mkdir(parents=True, exist_ok=True)
    (raw / (hashlib.sha256(url.encode()).hexdigest()[:16] + '.html')).write_text(html)
    return record


def main():
    parser = argparse.ArgumentParser()
    selection = parser.add_mutually_exclusive_group(required=True)
    selection.add_argument('--url')
    selection.add_argument('--all', action='store_true')
    parser.add_argument('--limit', type=int, default=200)
    parser.add_argument('--workers', type=int, choices=range(1,5), default=1)
    parser.add_argument('--snapshot-dir', action='append', default=[])
    args = parser.parse_args()
    catalog = read('catalog.json', {})
    registry = read('registry.json', {})
    selected = [r for r in catalog['records'] if not r.get('data_kind') and (args.all or r['url'] == args.url)]
    already = sum((r.get('html_extraction') or {}).get('version',0)>=VERSION for r in selected)
    if args.all:
        selected = [r for r in selected if (r.get('html_extraction') or {}).get('version',0)<VERSION]
    selected.sort(key=lambda r:r.get('fetched_at',''))
    report = {'started_at': now(), 'version': VERSION, 'selected': len(selected), 'already_current': already, 'succeeded': 0, 'reused_snapshots': 0, 'with_sections': 0, 'errors': []}
    fetcher = Fetcher()
    # Prepare robots once before workers start. The Fetcher spaces request starts.
    for sid in {r['source_id'] for r in selected[:args.limit]}:
        source=next(source_for(r['url']) for r in selected if r['source_id']==sid)
        fetcher.prepare(source)
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
      futures={pool.submit(refresh_record,r,fetcher,args.snapshot_dir):r for r in selected[:args.limit]}
      for future in as_completed(futures):
        previous=futures[future]
        try:
            record = future.result()
            catalog['records'] = [record if r['id'] == record['id'] else r for r in catalog['records']]
            registry[record['url']] = {**registry.get(record['url'], {}), 'hash': record['hash'],
                'fetched_at': record['fetched_at'], 'title': record['title'], 'pdfs': record['pdfs'],
                'html_extraction_version': VERSION}
            report['succeeded'] += 1
            report['reused_snapshots'] += record['html_extraction']['reused_snapshot']
            report['with_sections'] += bool(record['html_extraction']['sections'])
            print(record['id'], 'sections', len(record['html_extraction']['sections']), record['title'], flush=True)
        except Exception as ex:
            report['errors'].append({'id': previous['id'], 'url': previous['url'], 'error': str(ex)[:200]})
            print(previous['id'], 'retained:', str(ex)[:120], flush=True)
        catalog['generated_at'] = now()
        report['finished_at'] = now()
        report['remaining'] = len(selected) - report['succeeded']
        write(ROOT / 'data/catalog.json', catalog)
        write(ROOT / 'data/registry.json', registry)
        write(ROOT / 'data/html-refresh.json', report)
    html_records=[r for r in catalog['records'] if not r.get('data_kind')]
    current=[r for r in html_records if (r.get('html_extraction')or{}).get('version',0)>=VERSION]
    report.update(total_html_records=len(html_records),current_version=len(current),remaining=len(html_records)-len(current),with_sections_total=sum(bool(r['html_extraction']['sections'])for r in current),without_sections_total=sum(not r['html_extraction']['sections']for r in current))
    write(ROOT / 'data/html-refresh.json', report)
    print(report, flush=True)


if __name__ == '__main__':
    main()
