"""Extract labeled official HTML sections verbatim; never infer acceptance status."""
import re
import unicodedata
from bs4 import BeautifulSoup, NavigableString, Tag
from sources import source_for
VERSION = 2


def section_kind(heading):
    h = re.sub(r'[\s\u200b\ufeff]+', '', unicodedata.normalize('NFKC', heading))
    if re.search(r'補助額|補助率|給付額|給付金額|支給額|助成額|助成率|補助金額|支援内容|助成内容|補助内容|給付内容|対象経費', h):
        return 'amount'
    if re.search(r'対象者|対象事業者|対象企業|対象団体|対象となる方|利用できる方|申請できる方|申請資格|補助対象|助成対象|交付対象|支給対象', h):
        return 'eligibility'
    if re.search(r'注意事項|留意事項|申請期間|申請期限|募集期間|申請方法|申請手続|対象要件|給付要件|支給要件|補助要件', h):
        return 'conditions'
    if re.search(r'について$|概要$|制度の目的$|制度の内容$', h):
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
    current = {'heading': '制度の概要', 'kind': 'overview', 'lines': []}
    sections.append(current)

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
            cells = [block_text(c) for c in node.find_all(['th', 'td'], recursive=False)]
            # Some articles put field labels in table cells instead of headings.
            kind = section_kind(cells[0]) if len(cells) > 1 else None
            if kind:
                sections.append({'heading': cells[0], 'kind': kind, 'lines': [' ｜ '.join(cells[1:])]})
            elif current is not None:
                current['lines'].append(' ｜ '.join(cells))
        elif node.name in ('p', 'li', 'dt', 'dd') and not node.find(re.compile(r'^h[1-6]$')):
            if current is not None:
                current['lines'].append(block_text(node))
        else:
            for child in node.children:
                walk(child)

    walk(body)
    return [{'heading': s['heading'], 'kind': s['kind'], 'text': '\n'.join(x for x in s['lines'] if x.replace('\u200b','').replace('\ufeff','').strip())}
            for s in sections if s['kind'] and any(x.replace('\u200b','').replace('\ufeff','').strip() for x in s['lines'])
            and (s is not sections[0] or (len(''.join(s['lines'])) >= 40 and re.search(r'支援|制度|補助|助成|給付', ''.join(s['lines']))))]


def apply_extraction(record, html):
    sections = extract_sections(record['url'], html)
    record['html_extraction'] = {'version': VERSION, 'source_hash': record['hash'],
                                 'fetched_at': record['fetched_at'], 'sections': sections}
    project_sections(record)
    return record


PLACEHOLDER = '制度の詳細条件は掲載元の公式ページをご確認ください。'


def project_sections(record):
    """Use the same current source sections for cards and detail pages, including v1 data."""
    extraction = record.get('html_extraction') or {}
    if not extraction or extraction.get('source_hash') != record.get('hash'):
        return record
    sections = extraction.get('sections', [])
    # Recompute even when the source hash is unchanged: old versions stored null fields.
    for field in ('amount', 'eligibility'):
        record[field] = '\n\n'.join(s['heading'] + '\n' + s['text'] for s in sections if s['kind'] == field) or None
    overview = next((s['text'] for s in sections if s['kind'] == 'overview'), None)
    if overview:
        record['summary'] = overview.splitlines()[0]
    elif record.get('summary') == PLACEHOLDER:
        record['summary'] = ''
    # Classify the recipient, not people mentioned as the policy's beneficiaries.
    eligible = '\n'.join(s['text'] for s in sections if s['kind'] == 'eligibility')
    positive = re.split(r'ただし|次の.*対象外|対象外', eligible)[0]
    if re.search(r'企業|事業者|法人|事業主|事業所|中小企業', positive):
        record['audiences'] = ['事業者']
    elif re.search(r'世帯|保護者|児童の.*親|ひとり親', positive):
        record['audiences'] = ['個人・世帯']
        if re.search(r'児童|子ども|子育て|ひとり親', positive):
            record['audiences'].append('子育て世帯')
    elif re.search(r'自治会|町内会|地域団体', positive):
        record['audiences'] = ['地域団体']
    # Purpose may be expressed only in the article, as with the branded name はたいく.
    text = record.get('title', '') + '\n' + (overview or '')
    purposes = [p for p in record.get('purposes', []) if p != 'その他']
    if record.get('audiences') == ['事業者'] and '創業・事業支援' not in purposes:
        purposes.append('創業・事業支援')
    if re.search(r'子育て|育児|保育|就学|教育', text) and '子育て・教育' not in purposes:
        purposes.append('子育て・教育')
    record['purposes'] = purposes or ['その他']
    record['review_scope'] = '公式HTMLの見出し・表から自動抽出。人による内容確認と現在の受付状況は未確認。'
    return record
