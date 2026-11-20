// 「高知市の主な事業者支援制度」A3横・2ページ（二つ折り）のひな形。
// 文章と二次元コードのURLは令和8年12月版のチラシ（PowerPoint原稿）から転記。配置はA3実寸（mm）。
import {uid} from './model.mjs';

const ORANGE='#e2701e',GRAY='#7f7f7f',CREAM='#fdf0c8',YELLOW='#ffe600',RED='#d7262e',INK='#222222';
const CITY='https://www.city.kochi.kochi.jp/soshiki/';
const SEISAKU={contact:'高知市産業政策課',tel:'088-823-9456'};

const at=(x,y,w,h,rot=0)=>({id:uid('b'),x,y,w,h,rot});
const text=(x,y,w,h,value,o={},rot=0)=>({...at(x,y,w,h,rot),type:'text',data:{text:value,size:3.4,color:INK,bold:false,align:'left',bg:'none',border:'none',shadow:'none',italic:false,vertical:false,line:1.35,spacing:0,radius:0,underline:'none',...o}});
const ribbon=(x,y,w,value)=>text(x,y,w,6.4,value,{size:3.5,align:'center',bg:CREAM,border:INK,line:1.6});
const tag=(x,y,w,h,value,rot,o={})=>text(x,y,w,h,value,{size:3.4,align:'center',bold:true,bg:'#ffffff',border:INK,radius:1.5,line:1.25,...o},rot);
const frame=(x,y,w,h,o={})=>({...at(x,y,w,h),type:'box',data:{fill:'none',border:GRAY,width:.9,dash:false,radius:0,...o}});
const dashV=(x,y,h)=>({...at(x,y,.35,h),type:'box',data:{fill:'none',border:INK,width:.25,dash:true,radius:0}});
const dashH=(x,y,w)=>({...at(x,y,w,.35),type:'box',data:{fill:'none',border:INK,width:.25,dash:true,radius:0}});
const pill=(x,y,w,h,value)=>({...at(x,y,w,h),type:'heading',data:{text:value,accent:'',color:ORANGE,style:'pill',size:5.6}});
const slash=(x,y,w,accent,value)=>({...at(x,y,w,9),type:'heading',data:{text:value,accent,color:ORANGE,style:'slash',size:4.6}});
const image=(x,y,w,h,file)=>({...at(x,y,w,h),type:'image',data:{src:'assets/'+file}});
const shape=(x,y,w,h,kind,color=ORANGE,rot=0)=>({...at(x,y,w,h,rot),type:'shape',data:{kind,color}});
const sparkle=(x,y,s=7)=>shape(x,y,s,s,'sparkle',YELLOW);
const program=(x,y,w,h,o)=>({...at(x,y,w,h),type:'program',data:{title:'',subtitle:'',catch:'',body:'',amount:'',amountNote:'',period:'',contact:'',tel:'',url:'',source:null,draft:false,color:ORANGE,scale:1,style:'flyer',amountColor:INK,qrSize:13,...o}});
const stamp=(x,y,w,h,value,rot)=>({...at(x,y,w,h,rot),type:'stamp',data:{text:value,color:RED,shape:'rect'}});
const NOTE='※各種支援制度については、様々な要件がありますので二次元コードをご確認ください。';

function outside(){
 return [
  // 左面：その他の高知市からのお知らせ
  text(24,4,32,10,'ピックアップ',{size:3.8,color:ORANGE,align:'center',border:'#3b5c99',radius:50,italic:true,line:2.2},-10),
  text(62,9,62,9,'その他の高知市からの',{size:5,bold:true}),
  text(124,6,48,13,'お知らせ',{size:8.6,bold:true}),
  image(172,8,30,27,'woman-guide.png'),
  text(17,21,165,6,NOTE,{size:3.2,italic:true,underline:INK}),
  slash(20,27,110,'移住','してきた方には'),
  frame(18,40,187,84),dashV(111,42,78),
  ribbon(30,36.5,72,'受付は令和９年１月29日（金）まで'),
  ribbon(118,36.5,72,'受付は令和９年３月23日（火）まで'),
  program(20,44,90,79,{title:'地方創生移住支援金',catch:'東京圏からの移住・就業を支援します！',
   body:'東京23区内に住んでいる方又は東京圏から23区へ通勤している方で、高知市へ移住し、県が開設・運営するマッチングサイトに掲載されている移住支援金対象求人へ応募し、就職、または起業した方等を対象に支援します。',
   amount:'単身 60万円\n世帯100万円',amountNote:'※ 帯同する18歳未満の者1人につき100万円を加算',contact:'高知市移住・定住促進課',tel:'088-823-8813',url:CITY+'117/ijusienkin.html'}),
  program(113,44,90,68,{title:'UI孫ターン支援事業費補助金',catch:'高知市へのUIターン者の移住・定住を支援します！',
   body:'高知市へUIターンし、高知県内の企業等に就職・転職する方の転入・定住費用等を補助します！また、孫ターン、三世代同居又は若者に該当し、要件を満たす場合は、さらに補助金額を加算します。\n【補助対象費用】\n・高知市への転入に係る荷物の運搬に要する費用\n・住宅の賃貸契約に係る仲介手数料　等',
   amount:'補助率：10/10　最大 35万円',url:CITY+'117/uimagoturn.html'}),
  slash(26,127,110,'結婚','した方には'),sparkle(110,128,6),
  ribbon(55,136.5,110,'受付は７月１日（水）から令和９年２月26日（金）まで'),
  frame(18,141,187,51),
  program(20,143,183,47,{title:'結婚新生活支援事業補助金',catch:'新生活をスタートするおふたりを応援するため、家賃や引越費用等を支援します！',
   body:'令和８年１月１日から令和９年２月26日の間に婚姻届を提出し、受理された夫婦または高知市パートナーシップ登録制度により登録証を交付された方を対象に、家賃や引越費用を支給します。\nおふたりともが39歳以下、おふたりの所得合計が500万円未満などの要件があります。',
   amount:'最大 30万円',amountNote:'※ 親世帯と同居または近居の場合は最大45万円',contact:'高知市こども政策課',tel:'088-803-5067',url:CITY+'150/shinseikatsu.html',qrSize:15}),
  image(160,175,16,14,'couple.png'),sparkle(140,176,7),
  slash(26,194,110,'地域','に貢献したい！'),
  frame(20,204,98,82),
  program(22,206,94,60,{title:'企業（事業者）向けまちづくり相談窓口',catch:'高知市では、市民・事業者・NPO・行政による協働のまちづくりを推進しています！',
   body:'「社会貢献・地域貢献したい」けど、どんなことをすればよいか分からない、地域の特性や情報を知りたいなど、そんなこときはお気軽にご相談ください。',url:CITY+'21/kigyoumukematidukurisoudannmadoguti.html',qrSize:15,scale:.95}),
  image(60,252,30,13,'town.png'),
  text(24,268,92,16,'【福祉的分野】\n高知市地域共生社会推進課　　TEL：088-821-6513\n【その他分野】\n高知市地域コミュニティ推進課　TEL：088-823-9080',{size:2.9,bold:true,line:1.3}),
  text(122,204,86,80,'発行元\n\n高知市商工振興部産業政策課\n〒780-8571　高知市本町５丁目１-45\n☎ (088)-823-9456\nkc-150600@city.kochi.lg.jp\n【開庁時間】平日8時30分～17時15分\n※R8.7～　平日9時00分～16時30分\n\n【令和８年12月版】',{size:3.6,bold:true,align:'center',line:1.75}),
  // 右面：表紙
  shape(210,0,210,30,'wave-top'),
  text(244,3,90,18,'高知市の主な',{size:10,line:1.4}),
  image(226,30,166,47,'title-jigyosha-shien.jpg'),
  text(393,33,14,40,'制度',{size:11,vertical:true,line:1}),
  text(328,76,64,10,'【令和８年12月版】',{size:5.6,bold:true,align:'right'}),
  image(282,80,64,68,'cover-man.png'),
  tag(217,96,54,10,'支援を受けたい！',-8,{size:4.6,border:'none',shadow:ORANGE,radius:0}),
  tag(352,104,44,10,'相談したい！',-8,{size:4.6,border:'none',shadow:ORANGE,radius:0}),
  tag(285,132,46,10,'向上したい！',-8,{size:4.6,border:'none',shadow:ORANGE,radius:0}),
  sparkle(222,128,8),sparkle(234,143,7),
  shape(214,162,182,104,'board'),
  tag(276,155,50,10,'お知らせ',0,{size:5,bold:false,radius:2}),
  text(226,168,30,6,'R8.10～',{size:3.6}),sparkle(219,166,6),
  text(236,178,62,8,'追加募集スタート！',{size:5,bold:true,color:'#a0461a',underline:ORANGE,align:'center'}),
  text(215,197,96,7,'●中小企業等生産性向上設備導入支援補助金',{size:3.6,bold:true}),
  text(228,211,78,20,'１事業者300万円を上限に、生産性向上につながる設備等の導入経費の一部を補助します。',{size:3.5,line:1.45}),
  text(262,237,40,6,'⇒詳しくは裏面へ！',{size:3.6,underline:INK}),
  dashV(313,170,78),
  text(318,174,76,22,'「事業承継セミナー」を\n　開催します！\n　(参加無料・事前予約制）',{size:4.5,bold:true,color:'#a0461a',line:1.35}),
  text(318,198,76,11,'事業承継の第一歩は、知ることから。\n会社の未来を考えるきっかけになるセミナーです。',{size:3.2,line:1.4}),
  text(318,210,76,18,'●日時　令和８年11月26日（木）\n　　　　13：30～15：30\n●会場　かるぽーと９階　特別学習室',{size:3.6,line:1.45}),
  text(318,230,60,8,'セミナー終了後、希望者を対象に個別相談会を実施します。',{size:3,line:1.35}),
  text(318,244,58,5,'高知市産業政策課　TEL：088-823-9456',{size:2.6,bold:true}),
  {...at(379,237,14,14),type:'qr',data:{url:CITY+'40/jigyousyoukei.html',caption:''}},
  shape(210,264,210,33,'wave-bottom'),
  image(297,279,9,10,'kochi-emblem.jpg'),
  text(307,278,34,12,'高知市',{size:7,bold:true,color:'#ffffff',line:1.5}),
 ];
}

function inside(){
 return [
  // 左面：人材確保・育成
  text(26,8,44,10,'高知市の主な',{size:6,line:1.5}),
  image(70,3,62,19,'title-jigyosha-shien-small.jpg'),
  text(133,3,9,19,'制度',{size:5.6,vertical:true,line:1}),
  image(158,2,32,24,'cheer-trio.png'),sparkle(194,4,9),
  tag(136,21,72,15,'高知市で頑張る\n事業者を応援します！',0,{size:4.4,radius:1}),
  pill(16,27,64,9,'人材確保・育成'),
  frame(12,39,198,246),dashV(111,40,244),dashH(13,122,196),dashH(13,196,196),
  text(14,42,22,11,'R8～\nNEW',{size:4.2,bold:true,italic:true,bg:YELLOW,align:'center',line:1.05},-14),
  image(37,42,17,15,'woman-present.png'),
  tag(64,44,88,10,'はたらく、くらす若手を応援！',0,{size:4.8,radius:4}),
  text(154,43,52,12,'受講・受験の申込み前に\n市へ申請を！',{size:3.3,align:'center',bg:CREAM,border:INK,radius:6,line:1.35}),
  program(14,57,96,64,{title:'若手人材定着支援事業費補助金',subtitle:'（福利厚生費補助金）',catch:'福利厚生制度の新設・拡充に要する費用を助成します！',
   body:'若手人材の確保・定着のため、住宅補助や通勤費補助などの「福利厚生制度の新設・拡充」を行う中小企業に対して、費用の一部を補助します。',
   amount:'補助率：1/2　一人あたり10万円',amountNote:'【　１企業10名まで　】',...SEISAKU,url:CITY+'40/r8kochicity-wakatefukuri.html'}),
  image(98,62,10,10,'oshi.png'),
  tag(96,80,20,11,'はたくら\n補助金',-10,{size:3}),
  program(113,57,96,64,{title:'若手人材定着支援事業資格取得助成金',subtitle:'（資格取得助成金）',catch:'業務に必要な資格取得費の一部を助成します！',
   body:'若手人材の定着に向けて、業務上必要な資格を取得させる際に要した資格取得費用の一部を助成します。',
   amount:'補助率：1/2　一人あたり10万円',amountNote:'【　１企業10名まで　】',...SEISAKU,url:CITY+'40/r8kochicity-wakateshikaku.html'}),
  program(14,124,96,71,{title:'インターンシップ促進補助金',catch:'事業者の人材確保と求職者の職業選択能力・就業意欲向上を支援！',
   body:'事業者が実施するインターンシップにおいて、実習生を受け入れるために必要な経費を補助します。',
   amount:'補助率：2/3　実習生一人につき2万円まで',amountNote:'【申請書提出締切】令和９年2月26日',...SEISAKU,url:CITY+'40/innta-n.html',scale:.95}),
  program(113,124,96,71,{title:'リスキリング支援事業',catch:'市内事業者の人材育成を支援します！',
   body:'最先端で実践的なオンラインビジネス講座が無料で学べます。従業員のスキルアップや研修にご活用ください。\n令和６・７年度の利用企業様も再度利用が可能です！',
   amount:'後期　40企業',amountNote:'受講期間：令和８年11月16日～９年３月15日まで',...SEISAKU,url:CITY+'40/kochirisukiringu.html'}),
  image(190,125,18,13,'laptop-woman.png'),sparkle(120,168,7),
  text(36,199,52,7,'はたらく、育てるを応援！',{size:4,bold:true}),
  tag(89,198,20,11,'はたいく\n給付金',0,{size:3,radius:2}),
  program(14,206,96,78,{title:'子育て支援企業認定促進給付金',catch:'仕事と育児の両立支援を行う企業を支援します！',
   body:'「仕事と育児の両立支援」に向けた男性従業員の育児休業取得促進を支援し、次の①又は②の認定を受けた事業所に給付金を給付します。\n①高知県ワークライフバランス推進企業認証制度における男性育休推進部門の認証 ……10万円\n②厚生労働大臣のくるみん、くるみんプラス、プラチナくるみん、プラチナくるみんプラス、トライくるみん、トライくるみんプラスのいずれかの認定 ……30万円',
   ...SEISAKU,url:CITY+'40/hataiku.html',scale:.95}),
  image(88,264,9,18,'man-baby.png'),
  text(118,198,88,6,'〈 令和８・９・１０年度新規採用者対象〉',{size:3.2,align:'center'}),
  program(113,204,96,80,{title:'こうち奨学金返還支援制度の\n企業登録募集！',catch:'新規採用者に対し、県・市・企業が協働して奨学金返還を支援します！',
   body:'企業の負担額：（例）４年制大学卒採用者で 最大10万円/年・人\n新規採用者が高知市内在住の場合、高知市から新規採用者への上乗せ支援があります。採用内定前に新規採用者、企業がそれぞれ県へ登録が必要です。',
   amountNote:'登録（募集）期間：各年度の３月末日まで',contact:'高知県産業政策課',tel:'088-823-9692',url:''}),
  text(25,287,170,6,NOTE,{size:3.2,italic:true,underline:INK}),
  // 右面：業務改善・拡大／経営相談・融資
  pill(268,2,82,9,'業務改善・拡大'),
  text(354,1,22,9,'NEW',{size:5.4,bold:true,italic:true,bg:YELLOW,align:'center',line:1.6},-8),
  frame(213,12,205,278),dashV(312,13,276),
  dashH(214,89,98),dashH(214,135,98),dashH(214,179,98),dashH(214,231,98),
  dashH(313,90,104),{...at(313,150,105,.6),type:'box',data:{fill:GRAY,border:GRAY,width:.2,dash:false,radius:0}},dashH(313,228,104),
  program(214,14,97,74,{title:'外部人材活用促進事業',catch:'外部人材を活用したい市内企業を募集します!!',
   body:'「新しい販売方法を検討したいが、ノウハウがない」「外部視点のアイデアやアドバイスがほしい」など、販路開拓、社内のDX化、マーケティング等の専門スキルを持つ外部人材と一緒に課題解決に取り組む事業です。\n外部人材の募集やマッチング等の費用は本市が負担。（株）パソナJOBHUBによるサポートを受けられるため、安心してご活用いただけます。\n※外部人材への報酬や交通費等は事業者負担となります。',
   ...SEISAKU,url:CITY+'40/8gaibujinnzai.html',scale:.95}),
  image(299,17,10,10,'oshi.png'),
  program(214,91,97,43,{title:'空き店舗活用創業支援事業費補助金',body:'商店街や中心市街地の空き店舗に出店される方の店舗賃借料の一部を補助します。\n※支給には一定の要件があります。',
   amount:'最大補助率：2/3　最大10万円/月',amountNote:'満34歳以下の若年層はさらに補助率UP！',contact:'高知市商業振興課',tel:'088-823-9375',url:CITY+'128/akitenpo.html',scale:.95}),
  program(214,136,97,42,{title:'販路拡大サポート事業費補助金',body:'自社開発商品の販路拡大に向けた見本市出展やセミナー受講、栄養成分検査・広告等の経費を助成します。',
   amount:'補助率：1/2　最大 20万円　×2回　等',amountNote:'予算上限に達し次第、終了となります。',period:'令和８年4月1日～９年2月26日まで',contact:'高知市外商支援課',tel:'088-803-5089',url:CITY+'204/support.html',scale:.85}),
  text(214,181,18,8,'R8.8～',{size:3.8,bold:true,italic:true},-12),
  program(214,181,97,49,{title:'産業用地マッチング促進事業',catch:'製造業者の土地探し、一緒に考えます。',
   body:'移転・新設を考える製造業者と不動産業者をつなぎ、最適な産業用地探しをサポートする事業です。\n津波の影響を受けにくい安全な場所での事業展開を提案し、国の支援制度も活用できます。\n高知市が用地探しから事業開始まで伴走します。まずはお気軽にご相談ください。',
   ...SEISAKU,url:CITY+'40/kochishi-sangyoyochimaching.html',scale:.92}),
  image(297,187,11,9,'handshake.png'),
  program(214,233,97,56,{title:'経営改善計画策定等助成金',catch:'経営改善計画等を策定した費用の一部を助成します！',
   body:'経営改善や事業再生は早期の着手が重要です。専門家の支援を受けて経営改善計画等を策定する際の費用の一部を助成し、早期改善の対策を支援します。\n【助成金額】\n早期経営改善計画　　　：～２万円\n経営改善計画　　　　　：～10万円\nプレ再生・再生支援計画：～20万円',
   ...SEISAKU,url:'https://www.city.kochi.kochi.jp/site/bukkakoutoushien/keieikaizen.html',scale:.92}),
  text(318,13,64,7,'利用申込受付開始は10月１日～',{size:3.4,bg:CREAM,border:INK,align:'center',line:1.9}),
  text(388,12,25,8,'追加募集',{size:4.2,bold:true,color:RED,bg:YELLOW,align:'center',line:1.75},-5),
  program(314,21,103,68,{title:'中小企業等生産性向上設備導入支援補助金',catch:'生産性を向上させる設備等の導入に関する支援を行います！',
   body:'物価の上昇が続くなか、生産性向上のための設備等を新たに導入することで、従業員等の賃上げにつなげたいとお考えの中小企業者に対し、設備等導入経費の一部を補助します。\n例：500万円の設備導入をした場合\n①300万円まで 補助率2/3 ⇒ 補助金額200万円\n②残り200万円 補助率1/2 ⇒ 補助金額100万円　（①＋② 300万円）',
   amount:'最大300万円まで（補助率1/2～2/3）',amountColor:RED,amountNote:'予算上限に達し次第、終了となります。',period:'令和８年12月25日まで',...SEISAKU,url:CITY+'40/r7sentanhojokin.html',scale:.88}),
  image(318,92,11,12,'woman-guide.png'),
  tag(334,92,64,8,'デジタルでスマートな職場に！',0,{size:3.8,radius:4}),
  program(314,101,103,48,{title:'テレワーク導入支援事業費補助金',catch:'テレワーク環境整備費を補助します！',
   body:'ICT活用促進と人材確保力向上のため、テレワーク環境を整備する市内中小企業に対して、費用を一部を補助します。',
   amount:'補助率：1/2　最大30万円',amountNote:'予算上限に達し次第、終了となります。',...SEISAKU,url:CITY+'40/kochi-telwork.html',scale:.92}),
  tag(398,124,18,10,'デジスマ\n補助金',8,{size:2.8}),
  stamp(323,116,76,15,'受付終了しました。',-12),
  pill(320,153,84,9,'経営相談・融資'),
  program(314,164,103,63,{title:'高知市役所　サテライト相談窓口',subtitle:'高知県よろず支援拠点',catch:'創業や経営に関するご相談なんでも無料で対応！',
   body:'高知県よろず支援拠点による経営相談を、高知市役所内で受けることができます。\n毎週月曜日　10：00～16：00　開設中（相談時間は、１事業者につき１時間程度）\n※月曜日以外をご希望の場合にも可能な限り対応しますので、お気軽にご相談ください。※要予約',
   contact:'高知県よろず支援拠点',tel:'088-846-0175',url:CITY+'40/keieisoudan.html',scale:.9}),
  image(403,163,12,17,'woman-board.png'),
  program(314,230,103,59,{title:'物価高騰対策等短期継続融資',catch:'事業の運転資金の確保を支援する制度融資です！',
   body:'限度額1,500万円で事業に必要な運転資金調達を支援します。\n（～12月末まで。予算上限に達し次第終了）\n※お問い合わせは次の金融機関の支店窓口へ\n四国銀行　高知銀行　高知信用金庫　幡多信用金庫',
   amount:'低金利、保証料ゼロ!!',amountColor:RED,url:CITY+'40/yuusi-20210401.html',scale:.92}),
  text(400,246,17,9,'延長\nしました！',{size:2.6,bold:true,bg:YELLOW,align:'center',line:1.2,radius:50},12),
 ];
}

export function kochiBusinessFlyer(){
 return {version:1,title:'高知市の主な事業者支援制度【令和８年12月版】',orientation:'landscape',pages:[
  {id:uid('page'),background:null,blocks:outside()},
  {id:uid('page'),background:null,blocks:inside()},
 ]};
}
