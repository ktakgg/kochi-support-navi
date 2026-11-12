"""Extract labeled official HTML sections verbatim; never infer acceptance status."""
import re
from bs4 import BeautifulSoup, NavigableString, Tag
from sources import source_for
VERSION = 1


def section_kind(heading):
    h = re.sub(r'[\s\u200b\ufeff]+', '', heading)
    if re.search(r'補助額|補助率|給付額|給付金額|支給額|助成額|助成率|補助金額|支援内容|助成内容|補助内容|給付内容|対象経費', h):
        return 'amount'
    if re.search(r'対象者|対象事業者|対象企業|対象団体|対象となる方|利用できる方|申請できる方|申請資格', h):
        return 'eligibility'
    if re.search(r'注意事項|留意事項|申請期間|申請期限|募集期間|申請方法|申請手続|対象要件|給付要件|支給要件|補助要件', h):
        return 'conditions'
    if re.search(r'について$|概要$|制度の目的$', h):
        return 'overview'
    return None


def block_text(node):
    copy = BeautifulSoup(str(node), 'html.parser')
    for br in copy.select('br'):
        br.replace_with('\n')
    return '\n'.join(line.strip() for line in copy.get_text().splitlines() if line.strip())


def extract_sections(url, html):
    soup = BeautifulSoup(html, 'html.parser')
    source = source_for(url) or {}
    body = next((soup.select_one(s) for s in source.get('selectors', ['main']) if soup.select_one(s)), None)
    # Without a known article body, avoid collecting navigation or unrelated sidebar tables.
    if body is None:
        return []
    for el in body.select('script,style,nav,header,footer'):
        el.decompose()
    sections = []
    current = None

    def walk(node):
        nonlocal current
        if isinstance(node, NavigableString):
            value = str(node).strip(' \t\r\n\u200b\ufeff')
            if current is not None and value:
                current['lines'].append(value)
            return
        if not isinstance(node, Tag):
            return
        if re.fullmatch(r'h[1-6]', node.name):
            heading = node.get_text(' ', strip=True)
            current = {'heading': heading, 'kind': section_kind(heading), 'lines': []}
            sections.append(current)
        elif node.name == 'tr':
            # Keep each label and amount on the same row, including nested inline tags.
            if current is not None:
                current['lines'].append(' ｜ '.join(block_text(c) for c in node.find_all(['th', 'td'], recursive=False)))
        elif node.name in ('p', 'li', 'dt', 'dd') and not node.find(re.compile(r'^h[1-6]$')):
            if current is not None:
                current['lines'].append(block_text(node))
        else:
            for child in node.children:
                walk(child)

    walk(body)
    return [{'heading': s['heading'], 'kind': s['kind'], 'text': '\n'.join(x for x in s['lines'] if x.replace('\u200b','').replace('\ufeff','').strip())}
            for s in sections if s['kind'] and any(x.replace('\u200b','').replace('\ufeff','').strip() for x in s['lines'])]


def apply_extraction(record, html):
    sections = extract_sections(record['url'], html)
    record['html_extraction'] = {'version': VERSION, 'source_hash': record['hash'],
                                 'fetched_at': record['fetched_at'], 'sections': sections}
    # Recompute even when the source hash is unchanged: old versions stored null fields.
    for field in ('amount', 'eligibility'):
        record[field] = '\n\n'.join(s['heading'] + '\n' + s['text'] for s in sections if s['kind'] == field) or None
    record['review_scope'] = '公式HTMLの見出し・表から自動抽出。人による内容確認と現在の受付状況は未確認。'
    return record
