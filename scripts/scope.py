"""Publish only programs a business or resident in Kochi City can use.

National (全国), Shikoku and Kochi Prefecture programs stay. Programs run by another
municipality or prefecture are hidden even when Jグランツ registers them as 全国.
The catalog keeps every record so collection history and loss detection are unaffected.
"""
import re
import unicodedata

PREFECTURES = ('北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県', '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県',
               '東京都', '神奈川県', '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県', '静岡県', '愛知県', '三重県',
               '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県', '徳島県',
               '香川県', '愛媛県', '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県')
# Place names that identify another area without a 市・県 suffix.
OTHER_PLACES = {'京都型': '京都市', '東京港': '東京港', '成田空港': '成田空港', '東京23区': '東京23区'}
# Regional offices other than Shikoku handle only their own area.
OTHER_OFFICES = re.compile(r'(?:北海道|東北|関東|中部|近畿|中国|九州)(?:産業保安)?(?:監督部|支部)')
MUNICIPALITY = r'[一-龥ぁ-んァ-ヶ]{1,4}?[市町村]'
GENERIC = re.compile(r'^(?:各|全|当|本|同|他|旧|県内|国内)|^(?:指定|政令指定)?都市$|市町$|市町村')
LEADING = re.compile(r'^[【［\[]?(' + MUNICIPALITY + ')')
BRACKETED = re.compile(r'[【［\[](' + MUNICIPALITY + r')[】］\]]')
CONTEXT = re.compile(r'([一-龥ァ-ヶ]{1,4}?[市町村])(?:では|内で|内の|内に|内へ|への|に進出|に立地|在住|在勤)')
PRACTICE = re.compile(r'申請練習|練習用')


def _places(text, patterns):
    return [m.group(1) for p in patterns for m in p.finditer(text) if not GENERIC.search(m.group(1))]


def outside_reason(record):
    """Return why a record is outside Kochi City's reach, or None when it may apply."""
    # Official HTML sources are Kochi's own sites; only API/RSS mix in other areas.
    if record.get('data_kind') not in ('api', 'rss'):
        return None
    title = unicodedata.normalize('NFKC', record.get('title') or '')
    lead = unicodedata.normalize('NFKC', (record.get('summary') or '')[:150])
    names = ' '.join(k for k in (record.get('keywords') or []) if k)
    if PRACTICE.search(title):
        return 'Jグランツの申請練習用。実際の支援制度ではない。'
    for place, area in OTHER_PLACES.items():
        if place in title or place in lead or place in names:
            return f'{area}の事業者・地域が対象。高知市内では利用できない。'
    if (m := OTHER_OFFICES.search(title)):
        return f'{m.group(0)}の管轄区域が対象。高知市は四国の区域。'
    for pref in PREFECTURES:
        # A summary may name other areas as examples (「北海道や九州では」); require a scope phrase.
        if pref in title or re.search(r'(?:^|\s)' + pref + r'(?:\s|内|では|在住|に所在|の事業者)', lead):
            return f'{pref}内が対象。高知市内では利用できない。'
    for place in _places(title, (LEADING, BRACKETED)) + _places(names, (LEADING,)) + _places(title + ' ' + lead, (CONTEXT,)):
        if not place.startswith('高知'):
            return f'{place}の制度。高知市内では利用できない。'
    return None


def published(record, exclusions):
    return record['id'] not in exclusions and outside_reason(record) is None
