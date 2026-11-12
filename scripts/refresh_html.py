"""Refresh a known HTML record through the same extraction used by the daily crawl."""
import argparse, hashlib
from bs4 import BeautifulSoup
from crawl import ROOT, read, write, now, parse_page
from sources import Fetcher
from extract_html import apply_extraction


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', required=True)
    url = parser.parse_args().url
    catalog = read('catalog.json', {})
    record = next(r for r in catalog['records'] if r['url'] == url and not r.get('data_kind'))
    blob, charset = Fetcher().get(url)
    html = str(BeautifulSoup(blob, 'html.parser', from_encoding=charset))
    title, text, links, pdfs, updated = parse_page(url, html)
    if not text.strip():
        raise ValueError('Empty official article; previous record retained')
    digest = hashlib.sha256(text.encode()).hexdigest()
    record.update(title=title, hash=digest, fetched_at=now(), source_updated_at=updated,
                  pdfs=pdfs, review_state='pending', retrieval_state='fetched', checked_at=None,
                  rounds=[], evidence=[], summary='制度の詳細条件は掲載元の公式ページをご確認ください。')
    apply_extraction(record, html)
    registry = read('registry.json', {})
    registry[url] = {**registry.get(url, {}), 'hash': digest, 'fetched_at': record['fetched_at'], 'title': title, 'pdfs': pdfs}
    catalog['generated_at'] = now()
    write(ROOT / 'data/catalog.json', catalog)
    write(ROOT / 'data/registry.json', registry)
    print(record['id'], 'extracted', len(record['html_extraction']['sections']), 'sections')


if __name__ == '__main__':
    main()
