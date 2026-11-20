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
