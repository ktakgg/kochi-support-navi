"""Show partial collection failures without claiming that all sources succeeded."""
import json
from build import ROOT


def read(name, default):
    path = ROOT / 'data' / name
    return json.loads(path.read_text()) if path.exists() else default


print('## こうち支援ナビ 更新結果\n')
print(f"掲載候補: {len(read('catalog.json', {'records': []})['records'])}件\n")
print('| 掲載元 | 状態 | 今回取得 | 失敗 |')
print('| --- | --- | ---: | ---: |')
for name, status in read('source-status.json', {}).items():
    error = str(status.get('error', status.get('state', '未確認'))).replace('|', '\\|').replace('\n', ' ')
    print(f"| {name} | {error} | {status.get('visited', 0)} | {len(status.get('errors', []))} |")
coverage = read('coverage.json', {})
print(f"\n発見済み未解決候補: {coverage.get('unresolved_count', '未集計')}件。")
print('取得失敗時は前回データと取得日を保持します。取得は人による確認ではありません。全件網羅は未確認です。')
