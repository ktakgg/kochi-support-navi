// 「高知市の主な事業者支援制度」A3横・2ページ（二つ折り）のひな形。
// 文章と二次元コードのURLは令和8年12月版のチラシ（PowerPoint原稿）から転記。
// 位置・大きさは同版のPDFをA3実寸（mm）に重ねて測った値。
import {uid} from './model.mjs';

const ORANGE='#e2701e',GRAY='#7f7f7f',CREAM='#fdf0c8',YELLOW='#ffe600',RED='#e60012',INK='#222222',BLUE='#2f5597';
const CITY='https://www.city.kochi.kochi.jp/soshiki/';
const SEISAKU={contact:'高知市産業政策課',tel:'088－823－9456'};

const at=(x,y,w,h,rot=0)=>({id:uid('b'),x,y,w,h,rot});
const text=(x,y,w,h,value,o={},rot=0)=>({...at(x,y,w,h,rot),type:'text',data:{text:value,size:3.4,color:INK,bold:false,align:'left',bg:'none',border:'none',shadow:'none',italic:false,vertical:false,line:1.35,spacing:0,radius:0,underline:'none',font:'gothic',tape:'none',glow:'none',notch:false,...o}});
const ribbon=(x,y,w,value)=>text(x,y,w,7.5,value,{size:3.9,align:'center',bg:CREAM,border:INK,line:1.9});
const tag=(x,y,w,h,value,rot,o={})=>text(x,y,w,h,value,{size:3.4,align:'center',bold:true,bg:'#ffffff',border:INK,radius:1.5,line:1.25,...o},rot);
const frame=(x,y,w,h,o={})=>({...at(x,y,w,h),type:'box',data:{fill:'none',border:GRAY,width:1.1,dash:false,radius:0,...o}});
const dashV=(x,y,h,c=INK)=>({...at(x,y,.35,h),type:'box',data:{fill:'none',border:c,width:.3,dash:true,radius:0}});
const dashH=(x,y,w,c=INK)=>({...at(x,y,w,.35),type:'box',data:{fill:'none',border:c,width:.3,dash:true,radius:0}});
const line=(x,y,w,h,c)=>({...at(x,y,w,h),type:'box',data:{fill:c,border:c,width:0,dash:false,radius:0}});
const cell=(x,y,w,h)=>({...at(x,y,w,h),type:'box',data:{fill:'none',border:BLUE,width:.35,dash:false,radius:0}});
const pill=(x,y,w,h,value,size=6.2)=>({...at(x,y,w,h),type:'heading',data:{text:value,accent:'',color:ORANGE,style:'pill',size}});
const slash=(x,y,w,accent,value)=>({...at(x,y,w,10.5),type:'heading',data:{text:value,accent,color:ORANGE,style:'slash',size:4.7}});
const image=(x,y,w,h,file,fit='contain')=>({...at(x,y,w,h),type:'image',data:{src:'assets/'+file,fit}});
const shape=(x,y,w,h,kind,color=ORANGE,rot=0)=>({...at(x,y,w,h,rot),type:'shape',data:{kind,color}});
const sparkle=(x,y,w,h=w)=>shape(x,y,w,h,'sparkle',YELLOW);
const program=(x,y,w,h,o)=>({...at(x,y,w,h),type:'program',data:{title:'',subtitle:'',catch:'',body:'',amount:'',amountNote:'',period:'',contact:'',tel:'',url:'',source:null,draft:false,color:ORANGE,scale:1,style:'flyer',align:'center',amountColor:INK,qrSize:17,...o}});
const stamp=(x,y,w,h,value,rot)=>({...at(x,y,w,h,rot),type:'stamp',data:{text:value,color:RED,shape:'rect'}});
const qr=(x,y,s,url)=>({...at(x,y,s,s),type:'qr',data:{url,caption:''}});
// 「高知市の主な」：文字ごとに大きさと高さが違う原稿の組み方。
const kochiNoOmona=(x,y,k=1)=>[['高',0,1.2,1],['知',8.6,3.2,1],['市',17.2,-.6,1],['の',26.6,4.6,.72],['主',35,-1.6,1.1],['な',46.4,7,.72]]
 .map(([c,dx,dy,s])=>text(x+dx*k,y+dy*k,11*k*s,12*k*s,c,{size:10.4*k*s,font:'maru',line:1}));
const NOTE='※各種支援制度については、様々な要件がありますので二次元コードをご確認ください。';

function outside(){
 return [
  // 左面：その他の高知市からのお知らせ
  text(25,3,40,12.5,'ピックアップ',{size:4.2,color:ORANGE,align:'center',border:'#3b5c99',radius:50,italic:true,line:2.6,font:'maru'},-10),
  text(64,10,58,10,'その他の[大]高知市[/大]から[小]の[/小]',{size:4.9,bold:true,line:1.6,font:'maru'}),
  text(124,6,46,15,'お知らせ',{size:9.4,font:'maru',line:1.4}),
  image(177,10,25,25,'woman-guide.png'),
  text(17,21.5,160,5.5,NOTE,{size:3.25,italic:true,underline:INK}),
  slash(20,28,104,'移住','してきた方には'),sparkle(127,30,4,6),
  frame(18,40,187,85),dashV(111,41,73),dashH(19,114,185),
  ribbon(29.5,36.5,72,'受付は令和[赤]９[/赤]年１月[赤]29[/赤]日（金）まで'),
  ribbon(118,36.5,72,'受付は令和[赤]９[/赤]年３月23日（[赤]火[/赤]）まで'),
  program(20,45,90,67,{title:'地方創生移住支援金',catch:'東京圏からの移住・就業を支援します！',
   body:'東京23区内に住んでいる方又は東京圏から23区へ通勤している方で、高知市へ移住し、県が開設・運営するマッチングサイトに掲載されている移住支援金対象求人へ応募し、就職、または起業した方等を対象に支援します。',
   amount:'単身 60万円\n世帯100万円',url:CITY+'117/ijusienkin.html',qrSize:18}),
  text(21,104,68,9,'※ 帯同する18歳未満の者1人につき\n　100万円を加算',{size:3.2,line:1.3}),
  text(26,116.5,150,6,'高知市移住・定住促進課　　TEL：088－823－8813',{size:3.3,bold:true}),
  program(113,45,91,68,{title:'UI孫ターン支援事業費補助金',catch:'高知市へのUIターン者の移住・定住を支援します！',
   body:'高知市へUIターンし、高知県内の企業等に就職・転職する方の転入・定住費用等を補助します！また、孫ターン、三世代同居又は若者に該当し、要件を満たす場合は、さらに補助金額を加算します。\n【補助対象費用】\n・高知市への転入に係る荷物の運搬に要する費用\n・住宅の賃貸契約に係る仲介手数料　等',
   amount:'補助率：10/10　最大 35万円',url:CITY+'117/uimagoturn.html',qrSize:18}),
  slash(25,127.5,90,'結婚','した方には'),sparkle(110,128,6,7),
  frame(17.5,140,187.5,52),
  ribbon(53,135.5,110,'受付は７月１日（水）から令和９年２月26日（金）まで'),
  program(20,143,155,47,{title:'結婚新生活支援事業補助金',align:'left',catch:'新生活をスタートするおふたりを応援するため、家賃や引越費用等を支援します！',
   body:'令和８年１月１日から令和９年２月26日の間に婚姻届を提出し、受理された夫婦または高知市パートナーシップ登録制度により登録証を交付された方を対象に、家賃や引越費用を支給します。\nおふたりともが39歳以下、おふたりの所得合計が500万円未満などの要件があります。',
   amount:'最大 30万円　[小]※ 親世帯と同居または近居の場合は最大45万円[/小]',contact:'高知市こども政策課',tel:'088－803－5067',scale:.95}),
  image(176,152,19,15,'couple.png'),qr(176.25,167.75,19.0,CITY+'150/shinseikatsu.html'),sparkle(146,172,10,14),
  slash(25,194.5,90,'地域','に貢献したい！'),
  frame(19,204,98.5,81.5),
  program(21,206,94,52,{title:'企業（事業者）向けまちづくり相談窓口',catch:'高知市では、市民・事業者・NPO・行政による協働のまちづくりを推進しています！',
   body:'「社会貢献・地域貢献したい」けど、どんなことをすればよいか分からない、地域の特性や情報を知りたいなど、そんなこときはお気軽にご相談ください。',scale:1.02}),
  image(61,255,28,11,'town.png'),qr(95,251,18,CITY+'21/kigyoumukematidukurisoudannmadoguti.html'),
  text(24,270,90,15.5,'【福祉的分野】\n高知市地域共生社会推進課　　 TEL：088－821－6513\n【その他分野】\n高知市地域コミュニティ推進課　TEL：088－823－9080',{size:2.95,bold:true,line:1.35}),
  text(122,204,86,80,'発行元\n\n高知市商工振興部産業政策課\n〒780-8571　高知市本町５丁目１-45\n☎　(088)-823-9456\nkc-150600@city.kochi.lg.jp\n【開庁時間】平日8時30分～17時15分\n※R8.7～　平日9時00分～16時30分\n\n【令和８年[赤]12[/赤]月版】',{size:4.1,bold:true,align:'center',line:1.92}),
  // 右面：表紙
  shape(210,0,198,27,'wave-top'),
  ...kochiNoOmona(246,3,1.12),
  image(229,19,157,50,'title-jigyosha-shien.png','fill'),
  text(388,33,15,36,'制度',{size:13,vertical:true,line:1,font:'maru'}),
  text(334,74,66,10,'【令和８年[赤]12[/赤]月版】',{size:6,bold:true,align:'right',line:1.5}),
  image(282,79,41,52,'cover-man.png'),
  tag(217,95,59,13,'支援を受けたい！',-9,{size:5.8,border:'none',radius:0,tape:ORANGE,line:2.1}),
  tag(350,103,49,12,'相談したい！',-9,{size:5.4,border:'none',radius:0,tape:ORANGE,line:2.1}),
  tag(285,133,51,12,'向上したい！',-9,{size:5.4,border:'none',radius:0,tape:ORANGE,line:2.1}),
  sparkle(221,129,11,12),sparkle(254,140,10),
  shape(215,161,187,113,'board'),
  shape(225,248.5,20,8.5,'eraser-stack'),shape(249.5,253.5,19,4,'eraser'),shape(272.5,253.5,19,4,'eraser'),
  tag(275,155,57,13,'お知らせ',0,{size:6,bold:false,radius:2,notch:true,line:1.95,font:'maru'}),
  text(226,168,30,6,'R8.10～',{size:3.9}),sparkle(219,164,7,8),
  text(234,178.5,60,9,'追加募集スタート！',{size:5.4,bold:true,color:'#4a2200',glow:'#f0a060',underline:ORANGE,align:'center',font:'maru'}),
  text(216,199.5,96,7,'●中小企業等生産性向上設備導入支援補助金',{size:3.85,bold:true}),
  text(229.5,213,78,20,'1事業者300万円を上限に、生産性向上につながる設備等の導入経費の一部を補助します。',{size:3.9,line:1.42}),
  text(261,236.5,42,7,'⇒詳しくは裏面へ！',{size:3.9,underline:INK}),
  line(312.3,172,.4,72,'#e9a070'),
  text(318,175.5,82,24,'「事業承継セミナー」を\n　開催します！\n　（参加無料・事前予約制）',{size:4.85,bold:true,color:'#4a2200',glow:'#f0a060',underline:ORANGE,line:1.32,font:'maru'}),
  text(318,201,82,13,'事業承継の第一歩は、知ることから。\n会社の未来を考えるきっかけになるセミナーです。',{size:3.4,line:1.38}),
  text(318,215.5,82,18,'●日時　 令和８年11月26日（木）\n　　　　　13：30～15：30\n●会場　 かるぽーと９階　特別学習室',{size:4,line:1.38}),
  text(318,234.5,70,9,'セミナー終了後、希望者を対象に個別相談会を実施します。',{size:3.15,line:1.35}),
  text(318,245.5,64,5,'高知市産業政策課　TEL：088－823－9456',{size:2.7,bold:true}),
  qr(381.75,238.75,17.0,CITY+'40/jigyousyoukei.html'),
  shape(210,268,198,29,'wave-bottom'),
  image(293,281,13,13,'kochi-emblem.png'),
  text(306,279,40,15,'高知市',{size:8.8,bold:true,color:'#ffffff',line:1.6}),
 ];
}

function inside(){
 return [
  // 左面：人材確保・育成
  ...kochiNoOmona(29,6,.62),
  image(70,4,60,16,'title-jigyosha-shien-small.png','fill'),
  text(132,2.5,8.5,17,'制度',{size:6.6,vertical:true,line:1,font:'maru'}),
  image(159,3,28.5,19.5,'cheer-trio.png'),sparkle(194,4,13,14),
  tag(135,22,74,17,'高知市で頑張る\n事業者を応援します！',0,{size:4.9,radius:1,line:1.4,shadow:'#bbbbbb'}),
  pill(15.5,27,80,10,'人材確保・育成'),
  frame(12,39,198,247),dashV(112,40,245),dashH(13,128.5,196),dashH(13,197,196),
  text(15,41,22,17,'R8～\nNEW',{size:5,bold:true,italic:true,bg:YELLOW,align:'center',line:1.15,font:'maru'},-14),
  image(37,42,21,19,'woman-present.png'),
  tag(64,44,88,11,'はたらく、くらす若手を応援！',0,{size:5.4,radius:5,line:1.9,font:'maru'}),
  text(154.5,42.5,55,16,'受講・受験の[赤][太]申込み前[/太][/赤]に\n市へ申請を！',{size:3.9,align:'center',bg:CREAM,border:INK,radius:8,line:1.4,font:'maru'}),
  program(14,62,97,65,{title:'若手人材定着支援事業費補助金',subtitle:'（福利厚生費補助金）',catch:'福利厚生制度の新設・拡充に要する費用を助成します！',
   body:'若手人材の確保・定着のため、住宅補助や通勤費補助などの「福利厚生制度の新設・拡充」を行う中小企業に対して、費用の一部を補助します。',
   amount:'補助率：1/2　一人あたり10万円',amountNote:'【　１企業10名まで　】',...SEISAKU,url:CITY+'40/r8kochicity-wakatefukuri.html',scale:.97}),
  image(96,63,13,13,'oshi.png'),
  tag(99,84,23,12,'はたくら\n補助金',-12,{size:3.5}),
  program(113,62,97,65,{title:'若手人材定着支援事業資格取得助成金',subtitle:'（資格取得助成金）',catch:'業務に必要な資格取得費の一部を助成します！',
   body:'若手人材の定着に向けて、業務上必要な資格を取得させる際に要した資格取得費用の一部を助成します。',
   amount:'補助率：1/2　一人あたり10万円',amountNote:'【　１企業10名まで　】',...SEISAKU,url:CITY+'40/r8kochicity-wakateshikaku.html',scale:.97}),
  program(14,132,97,64,{title:'インターンシップ促進補助金',catch:'事業者の人材確保と求職者の職業選択能力・\n就業意欲向上を支援！',
   body:'事業者が実施するインターンシップにおいて、実習生を受け入れるために必要な経費を補助します。',
   amount:'補助率：2/3　[小]実習生一人につき[/小]2万円まで',amountNote:'【申請書提出締切】令和９年2月26日',...SEISAKU,url:CITY+'40/innta-n.html',scale:.9}),
  program(113,132,97,64,{title:'リスキリング支援事業',catch:'市内事業者の人材育成を支援します！',
   body:'最先端で実践的なオンラインビジネス講座が[赤]無料[/赤]で学べます。従業員のスキルアップや研修にご活用ください。\n令和６・７年度の利用企業様も再度利用が可能です！',
   amount:'後期　40企業',amountNote:'受講期間：令和８年11月16日～９年３月15日まで',...SEISAKU,url:CITY+'40/kochirisukiringu.html',scale:.95}),
  image(189,132.5,19,20,'laptop-woman.png'),sparkle(119,168,8,10),
  text(36,203,54,9,'[大]は[/大]た[小]らく[/小]、[大]育[/大]て[小]るを応援！[/小]',{size:4.6,bold:true,line:1.6,font:'maru'}),
  tag(89,200,21,12.5,'はたいく\n給付金',0,{size:3.5,radius:2}),
  program(14,213,97,32,{title:'子育て支援企業認定促進給付金',catch:'仕事と育児の両立支援を行う企業を支援します！',
   body:'「仕事と育児の両立支援」に向けた男性従業員の育児休業取得促進を支援し、次の①又は②の認定を受けた事業所に給付金を給付します。',scale:.95}),
  image(102,218,8,34,'man-baby.png'),
  cell(16,245,59,13),cell(75,245,19,13),cell(16,258,59,17),cell(75,258,19,17),
  text(17,245.5,58,12,'①高知県ワークライフバランス推進企業\n　認証制度における男性育休推進部門\n　の認証',{size:2.9,line:1.3}),
  text(75,247,19,9,'10万円',{size:4.2,bold:true,align:'center',line:2}),
  text(17,258.5,58,16,'②厚生労働大臣のくるみん、くるみんプラス、\n　プラチナくるみん、プラチナくるみんプラス、\n　トライくるみん、トライくるみんプラス\n　のいずれかの認定',{size:2.8,line:1.3}),
  text(75,262,19,9,'30万円',{size:4.2,bold:true,align:'center',line:2}),
  text(20,279,74,5,'高知市産業政策課　TEL：088－823－9456',{size:3,bold:true}),
  qr(92.75,267.75,17.5,CITY+'40/hataiku.html'),
  text(118,199.5,90,6,'〈 令和８・９・１０年度新規採用者対象〉',{size:3.4,align:'center',bold:true}),
  program(115,205,93,78,{title:'こうち奨学金返還支援制度の\n企業登録募集！',catch:'新規採用者に対し、県・市・企業が協働して奨学金返還を支援します！',
   amount:'[小]企業の負担額：(例)４年制大学卒採用者で[/小]\n最大10万円/年・人',
   body:'新規採用者が高知市内在住の場合、高知市から新規採用者への上乗せ支援があります。[太]採用内定前[/太]に新規採用者、企業がそれぞれ県へ[太]登録[/太]が必要です。\n[太]登録（募集）期間　：　各年度の３月末日まで[/太]',
   contact:'[大]高知県[/大]産業政策課',tel:'088－823－9692',scale:.95}),
  text(25,287.5,153,5.5,NOTE,{size:3.25,italic:true,underline:INK}),
  // 右面：業務改善・拡大／経営相談・融資
  pill(266,0,86,10.5,'業務改善・拡大',6.4),
  text(354,1,22,10,'NEW',{size:6,bold:true,italic:true,bg:YELLOW,align:'center',line:1.65,font:'maru'},-8),
  frame(211,11,99.5,278.5),frame(310.5,11,97,140),frame(310.5,158,97,131.5),
  dashH(212,89,98),dashH(212,134,98),dashH(212,180,98),dashH(212,230,98),dashH(311,89,96),dashH(311,226,96),
  program(213,13,96,75,{title:'外部人材活用促進事業',catch:'外部人材を活用したい市内企業を募集します!!',
   body:'「新しい販売方法を検討したいが、ノウハウがない」\n「外部視点のアイデアやアドバイスがほしい」など、販路開拓、社内のDX化、マーケティング等の専門スキルを持つ外部人材と一緒に課題解決に取り組む事業です。\n外部人材の募集やマッチング等の費用は本市が負担。（株）パソナJOBHUBによるサポートを受けられるため、安心してご活用いただけます。\n　※外部人材への報酬や交通費等は事業者負担となります。',
   ...SEISAKU,url:CITY+'40/8gaibujinnzai.html',scale:.95}),
  image(297.5,12.5,11.5,12.5,'oshi.png'),
  program(213,91,96,42,{title:'空き店舗活用創業支援事業費補助金',body:'商店街や中心市街地の空き店舗に出店される方の店舗賃借料の一部を補助します。\n※支給には一定の要件があります。',
   amount:'最大補助率：2/3　最大10万円/月',amountNote:'満34歳以下の若年層はさらに補助率UP！',contact:'高知市商業振興課',tel:'088－823－9375',url:CITY+'128/akitenpo.html',scale:.9}),
  program(213,136,96,43,{title:'販路拡大サポート事業費補助金',body:'自社開発商品の販路拡大に向けた見本市出展やセミナー受講、栄養成分検査・広告等の経費を助成します。',
   amount:'補助率：1/2　最大 20万円　×2回　等',amountNote:'予算上限に達し次第、終了となります。',period:'令和８年4月1日～９年2月26日まで',contact:'高知市外商支援課',tel:'088－803－5089',url:CITY+'204/support.html',scale:.86}),
  text(214,182,18,9,'R8.8～',{size:4.3,bold:true,italic:true,font:'maru'},-14),
  program(219,182,90,47,{title:'産業用地マッチング促進事業',catch:'製造業者の土地探し、一緒に考えます。',
   body:'移転・新設を考える製造業者と不動産業者をつなぎ、最適な産業用地探しをサポートする事業です。\n津波の影響を受けにくい安全な場所での事業展開を提案し、国の支援制度も活用できます。\n高知市が用地探しから事業開始まで伴走します。まずはお気軽にご相談ください。',
   ...SEISAKU,url:CITY+'40/kochishi-sangyoyochimaching.html',scale:.8,qrSize:15}),
  image(299,188,11,9,'handshake.png'),
  program(213,232,96,56,{title:'経営改善計画策定等助成金',catch:'経営改善計画等を策定した費用の一部を助成します！',
   body:'経営改善や事業再生は早期の着手が重要です。専門家の支援を受けて経営改善計画等を策定する際の費用の一部を助成し、早期改善の対策を支援します。\n[太]助成金額\n早期経営改善計画　　　：～２万円\n経営改善計画　　　　　：～10万円\nプレ再生・再生支援計画：～20万円[/太]',
   ...SEISAKU,url:'https://www.city.kochi.kochi.jp/site/bukkakoutoushien/keieikaizen.html',scale:.88}),
  text(312,12.5,70,7.5,'利用申込受付開始は[赤][太]10月１日～[/太][/赤]',{size:3.9,bg:CREAM,border:INK,align:'center',line:1.9}),
  text(383,10.5,22,9.5,'追加募集',{size:4.6,bold:true,color:RED,bg:YELLOW,align:'center',line:2,font:'maru'},-5),
  program(312,21,94,67,{title:'中小企業等生産性向上設備導入支援補助金',catch:'生産性を向上させる設備等の導入に関する支援を行います！',
   body:'物価の上昇が続くなか、生産性向上のための設備等を新たに導入することで、従業員等の賃上げにつなげたいとお考えの中小企業者に対し、設備等導入経費の一部を補助します。\n例：[赤]500[/赤]万円の設備導入をした場合\n①300万円まで 補助率2/3 ⇒ 補助金額200万円\n②残り[赤]200[/赤]万円 補助率1/2 ⇒ 補助金額[赤]100[/赤]万円（①＋② [赤]300万円[/赤]）',
   amount:'最大[赤]300[/赤]万円まで [小]（補助率1/2～2/3）[/小]',amountNote:'予算上限に達し次第、終了となります。',period:'令和８年12月25日まで',...SEISAKU,url:CITY+'40/r7sentanhojokin.html',scale:.86}),
  image(318,90.5,11,12.5,'woman-guide.png'),
  tag(334,91.5,64,11.5,'[大]デ[/大]ジタルで[大]ス[/大]マートな職場に！',0,{size:4.2,radius:5,line:2.1,font:'maru'}),
  program(312,103,94,47,{title:'テレワーク導入支援事業費補助金',catch:'テレワーク環境整備費を補助します！',
   body:'ICT活用促進と人材確保力向上のため、テレワーク環境を整備する市内中小企業に対して、費用を一部を補助します。',
   amount:'補助率：1/2　最大30万円',amountNote:'予算上限に達し次第、終了となります。',...SEISAKU,url:CITY+'40/kochi-telwork.html',scale:.88}),
  tag(385,116,18,11,'デジスマ\n補助金',10,{size:3}),
  stamp(320,117,82,16,'受付終了しました。',-12),
  pill(318,153,84,10.5,'経営相談・融資'),
  text(313,166.5,92,6,'創業や経営に関するご相談なんでも無料で対応！',{size:3.9,bold:true,align:'center'}),
  program(312,173,94,53,{title:'[小]高知県よろず支援拠点[/小]\n高知市役所　サテライト相談窓口',
   body:'高知県よろず支援拠点による経営相談を、\n高知市役所内で受けることができます。\n毎週月曜日　10：00～16：00　開設中\n（相談時間は、１事業者につき１時間程度）\n※月曜日以外をご希望の場合にも可能な限り\n　対応しますので、お気軽にご相談ください。',
   contact:'高知県よろず支援拠点',tel:'088－846－0175',url:CITY+'40/keieisoudan.html',scale:.86}),
  text(397,189,5,16,'※要予約',{size:2.9,vertical:true,line:1}),
  image(374,208,9,15,'woman-board.png'),
  program(312,229,94,59,{title:'物価高騰対策等短期継続融資',catch:'事業の運転資金の確保を支援する制度融資です！',url:CITY+'40/yuusi-20210401.html',scale:.9,pack:'top'}),
  text(333,250.5,54,11,'低金利、保証料ゼロ[小]!![/小]',{size:5.3,bold:true,color:'#ffffff',bg:'#111111',align:'center',line:2,font:'maru'}),
  text(315,262,70,25,'限度額1,500万円で事業に必要な\n運転資金調達を支援します。\n[太]（～12月末まで。予算上限に達し次第終了）\n※お問い合わせは次の金融機関の支店窓口へ\n四国銀行　高知銀行　高知信用金庫　幡多信用金庫[/太]',{size:3,align:'center',line:1.38}),
  text(391,228,17,13,'延長\nしました！',{size:3.3,bold:true,bg:YELLOW,align:'center',line:1.25,radius:50,font:'maru'},12),
 ];
}

export function kochiBusinessFlyer(){
 return {version:1,title:'高知市の主な事業者支援制度【令和８年12月版】',orientation:'landscape',pages:[
  {id:uid('page'),background:null,blocks:outside()},
  {id:uid('page'),background:null,blocks:inside()},
 ]};
}
