# こうち支援ナビ — Claude Code 作業ガイド

国・高知県・高知市・支援機関の補助金・助成制度を検索する静的サイト。GitHub Actions（`.github/workflows/pages.yml`）が毎朝6時（JST）に公式情報を収集・検証し、GitHub Pagesへ公開する。収集方針・制限の詳細は `RUNBOOK.md` が正。変更前に関係する節を読むこと。

## 構成
- `web/` 画面（index.html, app.js, core.mjs=検索・判定, autocomplete.mjs, motion.mjs, style.css）
- `scripts/scope.py` 掲載範囲（高知市内で利用できない他地域の制度を公開から除外）
- `scripts/` 収集（collect_structured.py=JグランツAPI/J-Net21 RSS, crawl.py=HTML巡回, collect_pdfs.py, refresh_html.py）、抽出（extract_html.py）、生成（build.py）、検証（validate_site.py）、掲載元定義（sources.py）
- `data/` 制度データ・台帳（catalog.json, registry.json, reviews.json, sources.json, exclusions.json 等）。Actionsが自動コミットする
- `dist/`（生成物）と `private/`（原資料）はGit管理外
- `tests/` Python unittest（test_*.py）と Node test（*.test.mjs）、`tests/fixtures/` に公式HTMLの固定サンプル

## 確認コマンド（変更後は必ず全部通す）
```bash
. .venv/bin/activate   # 未作成なら: python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt
BASE_PATH=/kochi-support-navi python scripts/build.py
python -m unittest discover -s tests -p 'test_*.py'
node --test tests/*.test.mjs
BASE_PATH=/kochi-support-navi python scripts/validate_site.py
```
収集スクリプト（collect_*/crawl/refresh_html）は公式サイトへアクセスするため、必要なときだけ実行する。通常の画面・抽出の修正では build とテストで足りる。

## 守るべきルール
- 未確認の条件（金額・対象者・募集状況・実施主体）を推測で補わない。根拠のない値は空欄・「要確認」のまま。
- 掲載元ラベル（国・県・市・支援機関）と実施主体（issuer_level/issuer_name）を混同しない。
- 403・503・タイムアウトを成功扱いしない。プロキシや証明書検証無効化で回避しない。
- 取得失敗時は前回データと本来の取得日時を維持する。
- 公式データ由来の文字列はHTMLとして実行しない（必ずエスケープ）。
- HTML抽出処理（extract_html.py）を変えたら `VERSION` を上げる。push時に旧版データが再抽出される。
- 配色・ヒーローSVG・アニメーション・検索候補の仕様は RUNBOOK.md の各節に従う。
- 既存コードは1行に詰めた短い記法（1スペースインデント・セミコロン連結）。周囲の書き方に合わせる。
- `data/` を手で編集する場合（reviews.json, exclusions.json 等）は根拠URL・ハッシュ・理由を残す。

## 公開の流れ
mainへpushするとActionsが再抽出→生成→テスト→検証→公開する。テスト・検証失敗時は公開されず前回版が残る。Actionsもmainへ `data/` をpushするため、push前に `git pull --rebase` で最新を取り込む。
