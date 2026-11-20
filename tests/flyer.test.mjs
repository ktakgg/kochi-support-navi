import test from 'node:test';
import assert from 'node:assert/strict';
import {programData,kochiText,otherPlaces,templateDocument,programBlock,autoLayout,sanitizeDocument,replaceContent,stampBlock,STAMPS,PAPER,searchRecords,yen} from '../dist/flyer/model.mjs';

const kyoto={id:'ex',title:'京都市企業立地促進制度補助金［市内初進出支援制度］',summary:'企業の京都市への初進出を支援！オフィス賃料最大2,000万円を補助します。',amount:'上限 70,000,000円',target_area:'全国',url:'https://www.jgrants-portal.go.jp/subsidy/a0WJ200000CDXFfMAP',outside_reason:'京都市の制度。'};

test('他地域の事例は地名を高知市に置き換えた下書きにし、元の出典を残す',()=>{
 assert.deepEqual(otherPlaces(kyoto),['京都市']);
 const d=programData(kyoto);
 assert.equal(d.title,'高知市企業立地促進制度補助金［市内初進出支援制度］');
 assert.match(d.catch,/^企業の高知市への初進出/);
 assert.equal(d.amount,'最大 7,000万円');
 assert.equal(d.draft,true);
 assert.equal(d.url,'');
 assert.equal(d.source.title,kyoto.title);
 assert.match(d.contact,/○○課/);
});

test('高知市内で使える制度は書き換えず、公式URLを二次元コードに使う',()=>{
 const r={id:'k',title:'高知市結婚新生活支援事業補助金',summary:'家賃や引越費用を支援します。',amount:'1世帯あたり30万円。ただし同居の場合は45万円。',url:'https://www.city.kochi.kochi.jp/x.html',source_name:'高知市',source_level:'市',purposes:[],audiences:[]};
 const d=programData(r);
 assert.equal(d.draft,false);assert.equal(d.url,r.url);assert.equal(d.title,r.title);assert.equal(d.amount,'30万円');
});

test('金額は万円・億円で表示する',()=>{assert.equal(yen(70000000),'7,000万円');assert.equal(yen(100000000),'1億円');assert.equal(yen(150000000),'1億5,000万円');assert.equal(yen(1500),'1,500円');});
test('都道府県名も対象地域の言い回しだけ置き換える',()=>{assert.equal(kochiText('東京都内に本社を置く企業',[]),'高知市内に本社を置く企業');assert.equal(kochiText('北海道や九州では',[]),'北海道や九州では');});

test('ひな形はA3実寸で、自動配置は制度の枠を用紙内に収める',()=>{
 for(const o of ['landscape','portrait']){
  const doc=templateDocument(o),page=doc.pages[0];
  for(let i=0;i<7;i++)page.blocks.push(programBlock(kyoto));
  autoLayout(page,o);
  for(const b of page.blocks.filter(b=>b.type==='program')){assert.ok(b.x>=0&&b.y>=0&&b.x+b.w<=PAPER[o].w+.1&&b.y+b.h<=PAPER[o].h+.1,o+JSON.stringify(b));}
 }
 assert.deepEqual(PAPER.landscape,{w:420,h:297});
});

test('中身の交換は位置と大きさを保つ',()=>{
 const b={...programBlock(kyoto),x:30,y:40,w:100,h:60,rot:0};
 const r=replaceContent(b,{title:'新しい制度',summary:'',amount:'',url:'https://example.jp/',purposes:[],audiences:[]});
 assert.deepEqual([r.x,r.y,r.w,r.h,r.id],[30,40,100,60,b.id]);assert.equal(r.data.title,'新しい制度');
});

test('受付終了スタンプが用意されている',()=>{const s=stampBlock(STAMPS[0]);assert.equal(s.data.text,'受付終了しました');assert.equal(s.type,'stamp');});

test('読み込んだファイルの危険な値を取り除く',()=>{
 const doc=sanitizeDocument({orientation:'portrait',pages:[{background:{src:'javascript:alert(1)'},blocks:[
  {type:'program',x:1,y:2,w:3,h:4,data:{title:'<img src=x onerror=alert(1)>',url:'javascript:alert(1)',color:'red;}'}},
  {type:'image',data:{src:'https://evil.example/x.png'}},{type:'script',data:{}},{type:'qr',data:{url:'https://www.city.kochi.kochi.jp/'}}]}]});
 assert.equal(doc.orientation,'portrait');assert.equal(doc.pages[0].background,null);
 const [p,q]=doc.pages[0].blocks;assert.equal(doc.pages[0].blocks.length,2);
 assert.equal(p.data.url,'');assert.equal(p.data.color,'#e2701e');assert.equal(p.data.title,'<img src=x onerror=alert(1)>');
 assert.equal(q.data.url,'https://www.city.kochi.kochi.jp/');
});

test('チラシの検索は本文検索と同じ言い換えを使い、範囲で絞れる',()=>{
 const rs=[{...kyoto,purposes:[],audiences:[]},{id:'k',title:'企業立地助成金',purposes:[],audiences:[]}];
 assert.equal(searchRecords(rs,'産業団地','kochi').length,1);
 assert.equal(searchRecords(rs,'産業団地','example').length,1);
 assert.equal(searchRecords(rs,'産業団地','all').length,2);
});

test('単価・端数処理の金額を大きな金額として表示しない',()=>{
 const p=t=>programData({title:'x',amount:t,purposes:[],audiences:[]}).amount;
 assert.equal(p('次のいずれか少ない金額 ア 除却工事費×23％ イ 22,000円×住宅の延床面積×23％'),'補助率 23%');
 assert.equal(p('助成額：3分の2（1,000円未満切り捨て）'),'補助率 3分の2');
 assert.equal(p('1世帯あたり30万円。ただし同居の場合は45万円。'),'30万円');
 assert.equal(p('上限 500,000円 ／ 補助率 2/3'),'最大 50万円');
});

import {kochiBusinessFlyer} from '../dist/flyer/templates.mjs';
import {programLook,arrange,isDesigned,findFreeSpot,sendToExtra,EXTRA_GRID,swapData} from '../dist/flyer/model.mjs';
test('ひな形「高知市の主な事業者支援制度」はA3横2ページで、検査を通しても欠けない',()=>{
 const raw=kochiBusinessFlyer(),doc=sanitizeDocument(raw);
 assert.equal(doc.orientation,'landscape');assert.equal(doc.pages.length,2);
 for(const [i,p] of doc.pages.entries()){
  assert.equal(p.blocks.length,raw.pages[i].blocks.length);
  for(const b of p.blocks)assert.ok(b.x>=0&&b.y>=0&&b.x+b.w<=420.5&&b.y+b.h<=297.5,JSON.stringify(b).slice(0,80));
 }
 const programs=doc.pages.flatMap(p=>p.blocks).filter(b=>b.type==='program');
 assert.ok(programs.length>=19);
 for(const b of programs)if(b.data.url)assert.match(b.data.url,/^https:\/\/www\.city\.kochi\.kochi\.jp\//);
 assert.ok(doc.pages.flatMap(p=>p.blocks).some(b=>b.type==='stamp'&&b.data.text.startsWith('受付終了')));
});

test('ひな形に追加する枠は同じ様式になり、入れ替えても見た目を保つ',()=>{
 const doc=sanitizeDocument(kochiBusinessFlyer()),look=programLook(doc);
 assert.equal(look.style,'flyer');
 const b=programBlock({title:'新制度',summary:'',amount:'上限 300,000円',purposes:[],audiences:[]},{x:0,y:0},undefined,look);
 assert.equal(b.data.style,'flyer');assert.equal(b.w,look.w);assert.equal(b.h,look.h);assert.equal(b.data.qrSize,look.qrSize);
 const slot=doc.pages[1].blocks.find(x=>x.type==='program');
 const swapped=replaceContent(slot,{title:'別の制度',summary:'',purposes:[],audiences:[]});
 for(const k of ['style','scale','qrSize','amountColor','color'])assert.equal(swapped.data[k],slot.data[k],k);
 assert.equal(swapped.data.title,'別の制度');
});

test('ひな形のページで自動配置しても既存の枠は動かず、入りきらない枠は同じ様式の追加ページに並ぶ',()=>{
 const doc=sanitizeDocument(kochiBusinessFlyer()),look=programLook(doc);
 const before=JSON.stringify(doc.pages.map(p=>p.blocks.filter(b=>b.type==='program').map(b=>[b.x,b.y,b.w,b.h])));
 assert.ok(isDesigned(doc.pages[0])&&isDesigned(doc.pages[1]));
 for(let i=0;i<5;i++){const b=programBlock({title:'追加'+i,purposes:[],audiences:[]},{x:100,y:100},undefined,look);doc.pages[1].blocks.push(b);}
 const r=arrange(doc,1);
 assert.equal(r.overflow,5);assert.equal(doc.pages.length,3);
 assert.equal(JSON.stringify(doc.pages.slice(0,2).map(p=>p.blocks.filter(b=>b.type==='program').map(b=>[b.x,b.y,b.w,b.h]))),before);
 const extra=doc.pages[2];assert.equal(extra.kind,'extra');
 const ps=extra.blocks.filter(b=>b.type==='program');assert.equal(ps.length,5);
 for(const b of ps){assert.equal(b.data.style,'flyer');assert.ok(b.x>=8&&b.y>=15&&b.x+b.w<=412&&b.y+b.h<=289,JSON.stringify([b.x,b.y,b.w,b.h]));}
 assert.equal(new Set(ps.map(b=>b.x+','+b.y)).size,5);
 assert.equal(arrange(doc,0).moved,0);
 for(let i=0;i<EXTRA_GRID.landscape.cols*EXTRA_GRID.landscape.rows;i++)sendToExtra(doc,programBlock({title:'x',purposes:[],audiences:[]},{x:0,y:0},undefined,look));
 assert.equal(doc.pages.length,4);
});

test('白紙のページでは空き場所が見つかり、作り込んだページの読み込み画像の上には置かない',()=>{
 const page={id:'p',background:null,blocks:[]};
 assert.deepEqual(findFreeSpot(page,96,64),{x:4,y:4});
 assert.equal(findFreeSpot({...page,background:{src:'data:image/png;base64,AA=='}},96,64),null);
});

test('クリックで既存の枠に入れると見た目を保ったまま文章だけ替わる',()=>{
 const doc=sanitizeDocument(kochiBusinessFlyer()),slot=doc.pages[1].blocks.find(b=>b.type==='program');
 const incoming=programBlock({title:'新しい制度',summary:'説明',purposes:[],audiences:[]},{x:0,y:0});
 const r=swapData(slot,incoming.data);
 assert.deepEqual([r.x,r.y,r.w,r.h,r.id],[slot.x,slot.y,slot.w,slot.h,slot.id]);
 for(const k of ['style','scale','qrSize','align','pack'])assert.equal(r.data[k],slot.data[k],k);
 assert.equal(r.data.title,'新しい制度');
});

test('細い区切り線・黒板消しなどの部品が検査で太くならない',()=>{
 const doc=sanitizeDocument(kochiBusinessFlyer()),blocks=doc.pages.flatMap(p=>p.blocks);
 assert.ok(blocks.some(b=>b.type==='box'&&b.w<1),'点線の幅が保たれる');
 for(const k of ['board','eraser','eraser-stack'])assert.ok(blocks.some(b=>b.type==='shape'&&b.data.kind===k),k);
 assert.ok(blocks.some(b=>b.type==='text'&&b.data.notch),'お知らせの吹き出し');
 assert.ok(blocks.some(b=>b.type==='image'&&b.data.fit==='fill'),'タイトル画像');
});

test('項目ごとの文字の大きさ・色・行間を保存でき、範囲外の値は丸める',()=>{
 const doc=sanitizeDocument({pages:[{blocks:[{type:'program',x:0,y:0,w:90,h:60,data:{title:'t',titleSize:1.4,bodySize:9,bodyLine:1.8,titleColor:'#ff0000',bodyColor:'red;x',catchColor:'#00ff00'}},
  {type:'text',x:0,y:0,w:50,h:10,data:{text:'[赤]12[/赤]月版',line:2,spacing:.3,color:'#123456'}}]}]});
 const [p,t]=doc.pages[0].blocks;
 assert.equal(p.data.titleSize,1.4);assert.equal(p.data.bodySize,2);assert.equal(p.data.bodyLine,1.8);
 assert.equal(p.data.titleColor,'#ff0000');assert.equal(p.data.bodyColor,'none');assert.equal(p.data.catchColor,'#00ff00');
 assert.equal(t.data.text,'[赤]12[/赤]月版');assert.equal(t.data.line,2);assert.equal(t.data.spacing,.3);assert.equal(t.data.color,'#123456');
});

test('市章は背景を透過したPNGを使う',()=>{
 const blocks=sanitizeDocument(kochiBusinessFlyer()).pages.flatMap(p=>p.blocks);
 assert.ok(blocks.some(b=>b.type==='image'&&b.data.src==='assets/kochi-emblem.png'));
 assert.ok(!blocks.some(b=>b.type==='image'&&/\.jpe?g$/.test(b.data.src)),'JPEGは透過できないため使わない');
});

test('ひな形の飾り（手持ちカード・雲形・額縁・星形）を部品で持つ',()=>{
 const blocks=sanitizeDocument(kochiBusinessFlyer()).pages.flatMap(p=>p.blocks);
 for(const f of ['hand-card.png','hands-frame.png','hand-point.png'])assert.ok(blocks.some(b=>b.type==='image'&&b.data.src==='assets/'+f),f);
 assert.ok(blocks.some(b=>b.type==='shape'&&b.data.kind==='cloud'&&b.data.stroke!=='none'),'雲形');
 assert.ok(blocks.some(b=>b.type==='shape'&&b.data.kind==='star'),'星形');
 const p2=sanitizeDocument(kochiBusinessFlyer()).pages[1].blocks,stampAt=p2.findIndex(b=>b.type==='stamp'),frameAt=p2.findIndex(b=>b.type==='image'&&b.data.src.endsWith('hands-frame.png'));
 assert.ok(frameAt>stampAt,'額縁はスタンプより手前');
});
