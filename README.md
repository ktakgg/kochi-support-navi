# こうち支援ナビ

国・高知県・高知市・支援機関の補助金・助成制度を検索する静的サイトです。

- 公開サイト: https://ktakgg.github.io/kochi-support-navi/
- 更新・公開履歴: https://github.com/ktakgg/kochi-support-navi/actions
- 公式API・RSSを優先し、登録した公式サイトのHTML・PDFで補完します。
- 未確認の条件は推測しません。全制度の掲載・全PDFの日次確認は未達です。

## 公開と自動更新

`.github/workflows/pages.yml` が情報収集・検証・公開を実行します。

| きっかけ | 処理 |
| --- | --- |
| mainへのpush | 保存済みデータから生成・テスト・公開 |
| 毎朝6時（日本時間） | 公式情報収集・生成・テスト・データ保存・公開 |
| ActionsのRun workflow | `refresh`が有効なら収集して公開。無効なら再生成のみ |

時刻はUTCの`0 21 * * *`で設定しています。Actionsの混雑で開始が遅れる場合があります。
公開リポジトリでは長期間の操作がないと定期実行が停止する場合があります。Actionsの履歴を確認してください。

GitHubのSettings → Pages → Sourceは **GitHub Actions** にします。
追加のAPIキーや個人アクセストークンは不要です。実行中の`GITHUB_TOKEN`を使用します。
テスト・生成・整合性確認・データ保存のいずれかが失敗した場合は公開せず、直前の公開を維持します。
一部の公式サイトの取得失敗は、その状況を記録して他の掲載元の処理を継続します。

## ローカル実行

Python 3.12とNode.js 24を使用します。

```sh
python -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements.txt
python scripts/collect_structured.py --max-details 30
python scripts/crawl.py --max-pages 160 --per-source 40 --time-budget 600 --delay 1.5
python scripts/collect_pdfs.py --max-files 20
BASE_PATH=/kochi-support-navi python scripts/build.py
python -m unittest discover -s tests -p 'test_*.py'
node --test tests/*.test.mjs
BASE_PATH=/kochi-support-navi python scripts/validate_site.py
```

ルート直下で公開する場合は`BASE_PATH`を省略します。Pagesでは設定から自動取得します。

## ファイル構成

| 場所 | 内容 |
| --- | --- |
| `web/` | 編集する画面・検索処理・スタイル・家のSVGイラスト |
| `scripts/` | 公式情報の収集、静的ページの生成、公開前の検証 |
| `data/` | 制度データ、巡回待ち列、取得記録、確認済み根拠。更新後にGitへ保存 |
| `dist/` | 公開するHTML・CSS・JS・JSON。ビルド時に生成しGitへ含めない |
| `private/` | 取得した原文・PDF。GitとPagesへ含めない |

毎回、Gitに保存済みの台帳から再開します。Actions実行環境の原資料は一時保存です。
人が確認した内容と自動取得した情報を区別し、本文やPDFが変わると確認状態を無効化します。

以前のSites版とは別の公開先です。GitHubの更新は以前のSites版へ自動反映されません。
収集方針や残る制限は`RUNBOOK.md`を参照してください。
