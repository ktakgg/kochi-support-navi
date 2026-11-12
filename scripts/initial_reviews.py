"""Initial source checks made during implementation; never applied to changed sources."""
import json,hashlib
from pathlib import Path
from bs4 import BeautifulSoup
from crawl import parse_page,write,ROOT,now
specs=[
('中小企業等生産性向上設備',{'summary':'設備導入を通じた生産性向上と賃上げを支援します。交付決定前の発注・契約・購入は対象外です。','amount':'上限300万円。経費300万円までは2/3、超過部分は1/2以内。','eligibility':'所定の要件を満たす設備を導入する中小企業等。詳細な事業者要件と認定手続きは公式案内をご確認ください。','audiences':['事業者'],'purposes':['創業・事業支援'],'rounds':[{'label':'二次エントリー（予算到達で終了）','start':'2026-10-15T08:30:00+09:00','end':'2026-12-25T16:30:00+09:00','confirmed_open':True}],'evidence':[{'field':'受付','quote':'二次エントリー（随時受付）を行います。'},{'field':'支援額','quote':'1事業者300万円を上限'}]}),
('子ども医療費助成事業',{'summary':'中学生までの子どもについて、保険診療の自己負担分を助成します。保険外診療などは対象外です。','amount':'保険診療の自己負担分を助成','eligibility':'高知市内に住む、健康保険に加入した中学生までの児童。生活保護受給中などの除外条件があります。','audiences':['個人・世帯','子育て世帯'],'purposes':['子育て・教育','健康・福祉'],'evidence':[{'field':'対象','quote':'高知市内にお住まいの中学生までの児童'}]}),
('インターンシップ促進補助金',{'summary':'市内中小企業等がインターンシップを実施する際の経費を支援します。実施前の申請が必要です。','amount':'補助率2/3。実習生1人あたり上限2万円。','eligibility':'対象要件を満たす市内中小企業等。対面を主とする2日以上の実習などの条件があります。','audiences':['事業者'],'purposes':['創業・事業支援'],'evidence':[{'field':'補助上限','quote':'受入実習生1名あたり…2万円'}]}),
('はたくら補助金',{'summary':'市内中小企業の若手人材の定着を支援します。福利厚生の拡充と業務に必要な資格取得が対象です。','amount':'補助率1/2。対象者1人あたり年10万円、事業者あたり合計100万円まで。','eligibility':'市内に本店または主たる事業所を持つ中小企業者。対象労働者の年齢などの条件があります。','audiences':['事業者'],'purposes':['創業・事業支援'],'evidence':[{'field':'支援額','quote':'1事業者あたり100万円まで'}]}),
('経営改善計画策定等助成金',{'summary':'経営改善などの計画策定にかかる専門家への費用の一部を支援します。計画の種類によって上限が異なります。','amount':'助成率1/3。計画に応じて上限2万円・10万円・20万円。','audiences':['事業者'],'purposes':['創業・事業支援'],'evidence':[{'field':'助成額','quote':'助成率 助成限度額'}]}),
('木造住宅の除却工事',{'summary':'耐震性のない木造住宅の除却工事を支援します。工事前の交付決定などが必要です。','amount':'工事費×23％、面積に応じた算定額、30万円のうち最も少ない額。','eligibility':'建築時期、耐震性、所有者等の要件を満たす木造住宅。過去の耐震改修補助の利用などに制限があります。','audiences':['個人・世帯'],'purposes':['住まい','地域・防災'],'rounds':[{'label':'令和8年度の受付','start':'2026-04-16T00:00:00+09:00','confirmed_open':True}],'evidence':[{'field':'受付','quote':'4月16日'},{'field':'算定上限','quote':'300,000円'}]}),
('老朽住宅等の解体',{'summary':'災害時の避難路確保などのため、危険な老朽住宅等の除却費用を支援します。事前確認が必要です。','amount':'工事費と面積に応じた算定額を比較。上限164万5千円。','eligibility':'市内の所定の立地・老朽度などを満たす空き家。所有者または相続人が対象です。','audiences':['個人・世帯'],'purposes':['住まい','地域・防災'],'rounds':[{'label':'令和8年度の受付','start':'2026-04-16T00:00:00+09:00','confirmed_open':True}],'evidence':[{'field':'受付','quote':'令和8年4月16日から申請を受け付けています。'},{'field':'上限','quote':'1,645,000円'}]}),
('テレワーク導入支援',{'summary':'市内中小企業のテレワーク環境整備を支援する制度です。予算上限に達したため受付は終了しています。','amount':'補助率1/2、1事業者あたり上限30万円。','audiences':['事業者'],'purposes':['創業・事業支援'],'closed':True,'evidence':[{'field':'受付終了','quote':'申請受付を終了しました。'}]}),
('住宅用蓄電池設備等導入促進事業費補助金の予算残額',{'summary':'住宅用蓄電池設備等の補助制度は、予算に達したため申請受付を終了しています。','closed':True,'audiences':['個人・世帯'],'purposes':['省エネ・環境','住まい'],'evidence':[{'field':'受付終了','quote':'申請受付を終了しました。'}]})]
reviews={}
for f in (ROOT/'private/snapshots').glob('*.html'):
 html=f.read_text();soup=BeautifulSoup(html,'html.parser');title=soup.h1.get_text(strip=True) if soup.h1 else ''
 for needle,fields in specs:
  if needle in title:
   _,text,_,_,_=parse_page('https://www.city.kochi.kochi.jp/',html)
   reviews[f.stem]={'source_hash':hashlib.sha256(text.encode()).hexdigest(),'checked_at':now(),'review_scope':'公式HTML本文の概要・掲載項目を確認。添付資料の全条件の照合は未完了。',**fields}
write(ROOT/'data/reviews.json',reviews);print('reviewed',len(reviews))
