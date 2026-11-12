"""Verify internal paths, catalog consistency, and unexpected data loss before deploy."""
import argparse
import json
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
from build import ROOT, DIST, base_path


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []

    def handle_starttag(self, tag, attrs):
        self.urls.extend(v for k, v in attrs if k in ('href', 'src') and v)


def validate(baseline=None):
    public = json.loads((DIST / 'data.json').read_text())
    catalog = json.loads((ROOT / 'data/catalog.json').read_text())
    exclusions = json.loads((ROOT / 'data/exclusions.json').read_text())
    expected = {r['id'] for r in catalog['records'] if r['id'] not in exclusions}
    actual = [r['id'] for r in public['records']]
    if not actual or len(actual) != len(set(actual)) or set(actual) != expected:
        raise ValueError('Public record IDs are empty, duplicated, or inconsistent')
    if baseline:
        before = json.loads(Path(baseline).read_text())['records']
        if len(catalog['records']) < len(before) * 0.8:
            raise ValueError('More than 20% of catalog records disappeared; inspect before publishing')
    prefix = base_path()
    for page in DIST.rglob('*.html'):
        parser = Links()
        parser.feed(page.read_text())
        for url in parser.urls:
            parts = urlsplit(url)
            if parts.scheme or parts.netloc or not parts.path:
                continue
            path = unquote(parts.path)
            if path.startswith('/'):
                if prefix and not path.startswith(prefix + '/'):
                    raise ValueError(f'URL escapes Pages base path: {page}: {url}')
                target = DIST / path[len(prefix):].lstrip('/')
            else:
                target = page.parent / path
            if target.is_dir():
                target /= 'index.html'
            if not target.is_file():
                raise ValueError(f'Missing internal target: {page}: {url}')
    app = (DIST / 'app.js').read_text()
    if "new URL('./data.json',import.meta.url)" not in app:
        raise ValueError('Data fetch must resolve relative to the app module')
    if '/support/${r.id}' in app.replace('./support/${r.id}', ''):
        raise ValueError('Detail links must resolve relative to the app module')
    print(f'Validated {len(actual)} records and all internal HTML paths (base={prefix or "/"})')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--baseline')
    validate(parser.parse_args().baseline)
