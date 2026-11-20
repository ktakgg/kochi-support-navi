// Flyer document model. Pure functions only, so the editor and tests share them.
import {cardDetails,queryMatches} from '../core.mjs';

export const PAPER={landscape:{w:420,h:297},portrait:{w:297,h:420}};
export const TYPES=['program','heading','text','stamp','image','qr','box','shape'];
export const SHAPES=['wave-top','wave-bottom','sparkle','board','eraser','eraser-stack','cloud','star','burst'];
export const STAMPS=[
 {text:'受付終了しました',color:'#d7262e',shape:'rect'},
 {text:'募集終了',color:'#d7262e',shape:'circle'},
 {text:'予算上限に達したため受付終了',color:'#d7262e',shape:'rect'},
 {text:'募集スタート！',color:'#e2701e',shape:'rect'},
 {text:'NEW',color:'#e2701e',shape:'circle'},
 {text:'延長しました！',color:'#2a7a3f',shape:'rect'},
 {text:'追加募集',color:'#c0392b',shape:'rect'},
 {text:'受付中',color:'#1f5fa8',shape:'circle'},
];
export const COLORS=['#e2701e','#a32126','#d7262e','#1f5fa8','#2a7a3f','#6b3fa0','#333333','#7f7f7f','#ffffff','#fdf0c8','#ffe600'];
export const DRAFT_NOTE='他地域の事例をもとにした高知市版の下書きです。金額・対象・期間・担当課は必ず確定させてください。';

let counter=0;
export const uid=prefix=>prefix+'-'+Date.now().toString(36)+'-'+(counter++).toString(36);
const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,Number.isFinite(+n)?+n:lo));
const text=(v,max=2000)=>String(v??'').slice(0,max);

export function newDocument(orientation='landscape'){
 return {version:1,title:'高知市の支援制度チラシ',orientation,pages:[newPage()]};
}
export function newPage(background=null){return {id:uid('page'),background,blocks:[]};}

// Municipality names that the Kochi City version must not keep.
const PLACE=/(?:(?<![一-龥ァ-ヶ])([一-龥ァ-ヶ]{1,4}?[市町村区])|(?<![ぁ-ん一-龥ァ-ヶ])([ぁ-ん]{2,4}[市町村]))(?=では|内|の|に|へ|を|が|は|と|、|。|\s|$|［|\[|（|\(|・|】|企業|事業|地域|在住|在勤|補助|助成|支援|診療|実証|移住)/gu;
const KEEP=/^(?:高知|各|全|当|本|同|他|県内|国内|都)|^(?:指定|政令指定)?都市$|市町村|市町$/;
const PREFS=['北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県','茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県','新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県'];
export function kochiText(value,places){
 let out=String(value??'');
 for(const p of places)out=out.split(p).join('高知市');
 for(const p of PREFS)out=out.replace(new RegExp(p+'(?=内|在住|在勤|の事業者|の企業)','gu'),'高知市');
 return out.replace(/高知市(?:高知市)+/g,'高知市');
}
export function otherPlaces(record){
 const source=[record.title,record.summary,record.eligibility,record.amount].join(' ');
 const found=new Set();
 for(const m of source.matchAll(PLACE)){const name=m[1]||m[2];if(!KEEP.test(name))found.add(name);}
 return [...found].sort((a,b)=>b.length-a.length);
}

export function yen(n){
 if(n>=1e8){const oku=Math.floor(n/1e8),man=Math.round(n%1e8/1e4);return oku+'億'+(man?man.toLocaleString('ja-JP')+'万':'')+'円';}
 if(n>=1e4&&n%1e3===0)return (n/1e4).toLocaleString('ja-JP')+'万円';
 return n.toLocaleString('ja-JP')+'円';
}
const plainYen=v=>{const n=Number(v.replace(/[,，\s]/g,'').replace(/円$/,''));return Number.isFinite(n)&&/^[0-9,，\s]+円$/.test(v)?yen(n):v.replace(/\s/g,'');};
export function bigAmount(amountText){
 const s=String(amountText||'').normalize('NFKC');
 const max=s.match(/(?:上限|最大|限度額)[^0-9]{0,6}([0-9,.]+\s*(?:億|万|千)?円)/);
 if(max)return '最大 '+plainYen(max[1]);
 // A bare amount only when it is the amount itself, not a unit price, threshold or rounding rule.
 for(const m of s.matchAll(/(?<![×x*0-9,.])([0-9][0-9,.]*\s*(?:億|万|千)?円)(?![0-9]|\s*(?:×|x|\*|未満|以上|以下|を超|超|ごと|毎|単位))/g)){
  if(!/未満|切り捨て|切捨/.test(s.slice(m.index,m.index+m[0].length+8)))return plainYen(m[1]);
 }
 const rate=s.match(/(?:補助率|助成率)?\s*([0-9]+\s*\/\s*[0-9]+|[0-9]+分の[0-9]+|[0-9]+\s*[%％])/);
 return rate?'補助率 '+rate[1].replace(/\s/g,''):'';
}
// Detail line under the big amount: the source text without the API cap already shown.
function amountDetail(full,big){
 const parts=String(full||'').split(/\s*／\s*/).map(x=>x.replace(/^補助率\s*/,'補助率 ').trim()).filter(x=>x&&!/^上限\s*[0-9,]+円$/.test(x));
 const detail=parts.join('／');
 return detail&&detail.replace(/\s/g,'')!==big.replace(/\s/g,'')?detail:'';
}
function periodText(record){
 const end=(record.rounds||[]).map(x=>x.end).filter(Boolean).sort().pop();
 if(!end)return '';
 const d=new Date(end);if(Number.isNaN(+d))return '';
 const [y,m,day]=d.toLocaleDateString('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'numeric',day:'numeric'}).split('/');
 return `受付は令和${Number(y)-2018}年${m}月${day}日まで`;
}

// Turn a search record into flyer content. Other-area examples become a marked Kochi draft.
export function programData(record,{kochi=true}={}){
 const card=cardDetails(record);
 const places=otherPlaces(record);
 const isExample=Boolean(record.outside_reason);
 const adapt=v=>kochi&&isExample?kochiText(v,places):String(v??'');
 const fullAmount=card.support.text||record.amount||'';
 return {
  title:adapt(record.title).replace(/^【[^】]{1,12}】\s*/,'').replace(/^補助金・助成金\s*[：:]\s*/,'').replace(/^「(.*)」$/,'$1').slice(0,60),
  catch:adapt(card.summary.text||''),
  body:adapt(card.eligibility.text?'対象：'+card.eligibility.text:''),
  amount:adapt(bigAmount(fullAmount)),
  amountNote:adapt(amountDetail(fullAmount,bigAmount(fullAmount))),
  period:isExample?'':periodText(record),
  contact:isExample?'高知市○○課':record.source_name||'',
  tel:isExample?'088-○○○-○○○○':'',
  url:isExample?'':record.url||'',
  source:{title:text(record.title,200),url:text(record.url,500),area:text(record.target_area||record.source_name,200)},
  draft:isExample&&kochi,
  color:record.audiences?.includes('事業者')||record.purposes?.includes('創業・事業支援')?'#e2701e':'#1f5fa8',
 };
}

// The look of program slots already on the flyer (様式). New slots copy it so they match the template.
const LOOK=['style','color','amountColor','qrSize','scale','align','pack','titleSize','catchSize','bodySize','amountSize','bodyLine','titleColor','catchColor','bodyColor'];
export function programLook(doc){
 const ps=(doc?.pages||[]).flatMap(p=>p.blocks).filter(b=>b.type==='program');
 if(!ps.length)return null;
 const count=new Map();for(const b of ps)count.set(b.data.style||'band',(count.get(b.data.style||'band')||0)+1);
 const style=[...count].sort((a,b)=>b[1]-a[1])[0][0],same=ps.filter(b=>(b.data.style||'band')===style);
 const med=k=>{const v=same.map(b=>b[k]).sort((a,b)=>a-b);return v[Math.floor(v.length/2)];};
 const ref=same[0].data;
 return {style,color:ref.color,amountColor:ref.amountColor||'#d7262e',qrSize:ref.qrSize||17,scale:Math.min(1,ref.scale||1),w:med('w'),h:med('h')};
}
function applyLook(block,look){
 if(!look)return block;
 for(const k of LOOK)if(look[k]!=null)block.data[k]=look[k];
 if(look.w&&look.h){block.w=look.w;block.h=look.h;}
 return block;
}
export function programBlock(record,at={x:12,y:40},options,look){
 return applyLook({id:uid('b'),type:'program',x:at.x,y:at.y,w:128,h:78,rot:0,loose:true,data:programData(record,options)},look);
}
export function emptyProgram(at={x:12,y:40},look){
 return applyLook({id:uid('b'),type:'program',x:at.x,y:at.y,w:128,h:78,rot:0,loose:true,data:{title:'制度名',subtitle:'',catch:'キャッチコピーを入力します！',body:'対象者や内容を入力します。',amount:'最大 ○○万円',amountNote:'',period:'受付は令和○年○月○日まで',contact:'高知市○○課',tel:'088-○○○-○○○○',url:'',source:null,draft:false,color:'#e2701e',scale:1,style:'band',amountColor:'#d7262e',qrSize:17}},look);
}
export function stampBlock(preset,at={x:150,y:100}){
 const circle=preset.shape==='circle';
 return {id:uid('b'),type:'stamp',x:at.x,y:at.y,w:circle?40:Math.min(140,22+preset.text.length*9),h:circle?40:20,rot:-12,data:{text:preset.text,color:preset.color,shape:preset.shape}};
}
export function headingBlock(textValue='見出し',at={x:12,y:30},color='#e2701e'){return {id:uid('b'),type:'heading',x:at.x,y:at.y,w:128,h:11,rot:0,data:{text:textValue,color}};}
export function textBlock(textValue='テキスト',at={x:20,y:20}){return {id:uid('b'),type:'text',x:at.x,y:at.y,w:100,h:20,rot:0,data:{text:textValue,size:5,color:'#333333',bold:false,align:'left'}};}
export function boxBlock(at={x:20,y:20}){return {id:uid('b'),type:'box',x:at.x,y:at.y,w:80,h:40,rot:0,data:{fill:'#ffffff',border:'#ffffff'}};}
export function qrBlock(url='',at={x:20,y:20}){return {id:uid('b'),type:'qr',x:at.x,y:at.y,w:22,h:26,rot:0,data:{url,caption:'詳しくはこちら'}};}
export function imageBlock(src,at={x:20,y:20},w=60,h=40){return {id:uid('b'),type:'image',x:at.x,y:at.y,w,h,rot:0,data:{src}};}

// Swap contents but keep the slot (position, size, rotation) on the sheet.
// Put new wording into an existing slot while keeping the slot's look.
export function swapData(block,data){
 const next={...data};
 for(const k of LOOK)if(block.data[k]!=null)next[k]=block.data[k];
 return {...block,data:next};
}
export function replaceContent(block,record,options){
 // Keep the slot's look (様式・文字の大きさ・QRの大きさ) and only swap the wording.
 const data=programData(record,options);
 for(const k of LOOK)if(block.data[k]!=null)data[k]=block.data[k];
 return {...block,data};
}

// The standard "主な支援制度" layout: header, then programs in an even grid.
export function templateDocument(orientation='landscape',title='高知市の主な事業者支援制度',edition='【令和○年○月版】'){
 const doc=newDocument(orientation),paper=PAPER[orientation],page=doc.pages[0];
 page.blocks.push({id:uid('b'),type:'box',x:0,y:0,w:paper.w,h:30,rot:0,data:{fill:'#e2701e',border:'#e2701e'}});
 page.blocks.push({...textBlock(title,{x:12,y:6}),w:paper.w-110,h:18,data:{text:title,size:12,color:'#ffffff',bold:true,align:'left'}});
 page.blocks.push({...textBlock(edition,{x:paper.w-95,y:9}),w:85,h:12,data:{text:edition,size:7,color:'#ffffff',bold:true,align:'right'}});
 page.blocks.push({...textBlock('発行元：高知市○○部○○課　TEL：088-○○○-○○○○　※各種支援制度には要件があります。二次元コードから詳細をご確認ください。',{x:12,y:paper.h-14}),w:paper.w-24,h:9,data:{text:'発行元：高知市○○部○○課　TEL：088-○○○-○○○○　※各種支援制度には要件があります。二次元コードから詳細をご確認ください。',size:3.6,color:'#333333',bold:false,align:'left'}});
 return doc;
}

// Arrange program blocks into a grid between the header and footer (plain pages only).
export function autoLayout(page,orientation='landscape',{top=36,bottom=18,margin=10,gap=5,cols,rows:fixedRows}={}){
 const paper=PAPER[orientation];
 const programs=page.blocks.filter(b=>b.type==='program');
 if(!programs.length)return page;
 cols??=orientation==='landscape'?(programs.length<=4?2:programs.length<=9?3:4):2;
 const rows=fixedRows||Math.ceil(programs.length/cols);
 const w=(paper.w-margin*2-gap*(cols-1))/cols,h=(paper.h-top-bottom-gap*(rows-1))/rows;
 programs.forEach((b,i)=>{Object.assign(b,{x:round(margin+(i%cols)*(w+gap)),y:round(top+Math.floor(i/cols)*(h+gap)),w:round(w),h:round(h),rot:0});b.loose=false;});
 return page;
}
// Blocks that carry content; frames, dotted lines and decorative shapes may sit under a slot.
const SOLID=['program','text','image','qr','heading','stamp'];
const hits=(a,b,m=0)=>a.x<b.x+b.w+m&&b.x<a.x+a.w+m&&a.y<b.y+b.h+m&&b.y<a.y+a.h+m;
export function isDesigned(page){
 return Boolean(page.background)||page.kind==='extra'||page.blocks.some(b=>b.type==='image'||b.type==='shape'||(b.type==='heading'&&b.data.style!=='band'));
}
export function findFreeSpot(page,w,h,orientation='landscape',ignore=null,margin=4){
 const paper=PAPER[orientation],obstacles=page.blocks.filter(b=>SOLID.includes(b.type)&&b.id!==ignore);
 if(page.background)return null; // the scanned flyer itself fills the page
 for(let y=margin;y+h<=paper.h-margin;y+=2)for(let x=margin;x+w<=paper.w-margin;x+=2){const r={x,y,w,h};if(!obstacles.some(o=>hits(r,o,1)))return {x,y};}
 return null;
}
// A continuation page in the same style for slots that no longer fit (その他の支援制度).
export function extraPage(orientation='landscape',color='#e2701e'){
 const paper=PAPER[orientation],page=newPage();page.kind='extra';
 page.blocks.push({id:uid('b'),type:'heading',x:12,y:4,w:84,h:9,rot:0,data:{text:'その他の支援制度',accent:'',color,style:'pill',size:5.6}});
 page.blocks.push({id:uid('b'),type:'box',x:8,y:15,w:paper.w-16,h:paper.h-24,rot:0,data:{fill:'none',border:'#7f7f7f',width:.9,dash:false,radius:0}});
 return page;
}
export const EXTRA_GRID={landscape:{cols:4,rows:4},portrait:{cols:3,rows:5}};
export function layoutExtra(page,orientation='landscape'){
 const g=EXTRA_GRID[orientation];
 return autoLayout(page,orientation,{top:18,bottom:11,margin:10,gap:2,cols:g.cols,rows:g.rows});
}
// Place loose slots: keep the template's own slots where they are, move only new ones.
export function arrange(doc,pageIndex){
 const page=doc.pages[pageIndex],o=doc.orientation;
 if(!isDesigned(page)){autoLayout(page,o);return {moved:page.blocks.filter(b=>b.type==='program').length,overflow:0};}
 if(page.kind==='extra'){layoutExtra(page,o);return {moved:page.blocks.filter(b=>b.type==='program').length,overflow:0};}
 let moved=0,overflow=0;
 for(const b of page.blocks.filter(b=>b.type==='program'&&b.loose)){
  const spot=findFreeSpot(page,b.w,b.h,o,b.id);
  if(spot){Object.assign(b,spot,{rot:0});b.loose=false;moved++;continue;}
  page.blocks=page.blocks.filter(x=>x!==b);sendToExtra(doc,b);overflow++;
 }
 return {moved,overflow};
}
export function sendToExtra(doc,block){
 const o=doc.orientation,cap=EXTRA_GRID[o].cols*EXTRA_GRID[o].rows;
 let page=doc.pages.find(p=>p.kind==='extra'&&p.blocks.filter(b=>b.type==='program').length<cap);
 if(!page){page=extraPage(o,block.data.color);doc.pages.push(page);}
 page.blocks.push(block);layoutExtra(page,o);return page;
}
const round=n=>Math.round(n*10)/10;

// Saved files come from users; accept only known shapes, numbers and image data URLs.
const IMAGE=/^(?:data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+|assets\/[a-z0-9-]+\.(?:png|jpe?g|webp))$/;
const COLOR=/^(?:#[0-9a-fA-F]{6}|none)$/;
const safeColor=(v,fallback)=>COLOR.test(v)?v:fallback;
const safeUrl=v=>{try{const u=new URL(String(v));return ['https:','http:'].includes(u.protocol)?u.href.slice(0,500):'';}catch{return '';}};
export function sanitizeDocument(input){
 const orientation=input?.orientation==='portrait'?'portrait':'landscape',paper=PAPER[orientation];
 const pages=(Array.isArray(input?.pages)?input.pages:[]).slice(0,12).map(p=>({
  id:text(p.id,40)||uid('page'),
  kind:p.kind==='extra'?'extra':undefined,
  background:p.background&&IMAGE.test(p.background.src||'')?{src:p.background.src,name:text(p.background.name,120)}:null,
  blocks:(Array.isArray(p.blocks)?p.blocks:[]).filter(b=>TYPES.includes(b?.type)).slice(0,300).map(b=>sanitizeBlock(b,paper)).filter(Boolean),
 }));
 return {version:1,title:text(input?.title,120)||'チラシ',orientation,pages:pages.length?pages:[newPage()]};
}
function sanitizeBlock(b,paper){
 const d=b.data||{},base={id:text(b.id,60)||uid('b'),type:b.type,loose:b.loose===true||undefined,x:clamp(b.x,-paper.w,paper.w*2),y:clamp(b.y,-paper.h,paper.h*2),w:clamp(b.w,.2,paper.w*2),h:clamp(b.h,.2,paper.h*2),rot:clamp(b.rot,-180,180)};
 const num=(v,lo,hi,dflt)=>v==null||v===''?dflt:clamp(v,lo,hi);
 switch(b.type){
  case 'program':return {...base,data:{title:text(d.title,200),subtitle:text(d.subtitle,120),catch:text(d.catch,400),body:text(d.body,1200),amount:text(d.amount,200),amountNote:text(d.amountNote,400),period:text(d.period,120),contact:text(d.contact,120),tel:text(d.tel,60),url:safeUrl(d.url),source:d.source?{title:text(d.source.title,200),url:safeUrl(d.source.url),area:text(d.source.area,200)}:null,draft:Boolean(d.draft),color:safeColor(d.color,'#e2701e'),scale:clamp(d.scale??1,.5,2),style:['band','plain','flyer'].includes(d.style)?d.style:'band',align:d.align==='left'?'left':'center',pack:d.pack==='top'?'top':'spread',amountColor:safeColor(d.amountColor,'#d7262e'),titleSize:num(d.titleSize,.5,2,1),catchSize:num(d.catchSize,.5,2,1),bodySize:num(d.bodySize,.5,2,1),amountSize:num(d.amountSize,.5,2,1),bodyLine:num(d.bodyLine,.9,2.6,1.38),titleColor:safeColor(d.titleColor,'none'),catchColor:safeColor(d.catchColor,'none'),bodyColor:safeColor(d.bodyColor,'none'),qrSize:num(d.qrSize,8,40,17)}};
  case 'heading':return {...base,data:{text:text(d.text,120),accent:text(d.accent,40),color:safeColor(d.color,'#e2701e'),style:['band','pill','slash'].includes(d.style)?d.style:'band',size:num(d.size,2,30,5.2)}};
  case 'text':return {...base,data:{text:text(d.text,3000),size:clamp(d.size,1.5,60),color:safeColor(d.color,'#333333'),bold:Boolean(d.bold),align:['left','center','right'].includes(d.align)?d.align:'left',bg:safeColor(d.bg,'none'),border:safeColor(d.border,'none'),shadow:safeColor(d.shadow,'none'),italic:Boolean(d.italic),vertical:Boolean(d.vertical),line:num(d.line,.9,2.5,1.4),spacing:num(d.spacing,0,2,0),radius:num(d.radius,0,50,0),underline:safeColor(d.underline,'none'),font:['maru','gothic','hand'].includes(d.font)?d.font:'gothic',tape:safeColor(d.tape,'none'),glow:safeColor(d.glow,'none'),notch:Boolean(d.notch)}};
  case 'stamp':return {...base,data:{text:text(d.text,40),color:safeColor(d.color,'#d7262e'),shape:d.shape==='circle'?'circle':'rect'}};
  case 'image':return IMAGE.test(d.src||'')?{...base,data:{src:d.src,fit:d.fit==='fill'?'fill':'contain'}}:null;
  case 'qr':return {...base,data:{url:safeUrl(d.url),caption:text(d.caption,40)}};
  case 'box':return {...base,data:{fill:safeColor(d.fill,'#ffffff'),border:safeColor(d.border,'#ffffff'),width:num(d.width,0,5,.4),dash:Boolean(d.dash),radius:num(d.radius,0,50,0)}};
  case 'shape':return SHAPES.includes(d.kind)?{...base,data:{kind:d.kind,color:safeColor(d.color,'#e2701e'),stroke:safeColor(d.stroke,'none')}}:null;
 }
 return null;
}

// Search across Kochi-usable programs and other-area examples.
export function searchRecords(records,query,scope='all'){
 // Same matching as the main search (synonyms such as 産業団地＝工業団地＝企業立地, extracted body text).
 return records.filter(r=>(scope==='all'||(scope==='kochi'?!r.outside_reason:Boolean(r.outside_reason)))&&queryMatches({...r,purposes:r.purposes||[],audiences:r.audiences||[]},query||''));
}
