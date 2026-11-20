// Flyer document model. Pure functions only, so the editor and tests share them.
import {cardDetails,queryMatches} from '../core.mjs';

export const PAPER={landscape:{w:420,h:297},portrait:{w:297,h:420}};
export const TYPES=['program','heading','text','stamp','image','qr','box'];
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
export const COLORS=['#e2701e','#a32126','#1f5fa8','#2a7a3f','#6b3fa0','#333333'];
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

export function programBlock(record,at={x:12,y:40},options){
 return {id:uid('b'),type:'program',x:at.x,y:at.y,w:128,h:78,rot:0,data:programData(record,options)};
}
export function emptyProgram(at={x:12,y:40}){
 return {id:uid('b'),type:'program',x:at.x,y:at.y,w:128,h:78,rot:0,data:{title:'制度名',catch:'キャッチコピーを入力します！',body:'対象者や内容を入力します。',amount:'最大 ○○万円',amountNote:'',period:'受付は令和○年○月○日まで',contact:'高知市○○課',tel:'088-○○○-○○○○',url:'',source:null,draft:false,color:'#e2701e'}};
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
export function replaceContent(block,record,options){
 return {...block,data:programData(record,options)};
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

// Arrange program blocks into a grid between the header and footer.
export function autoLayout(page,orientation='landscape',{top=36,bottom=18,margin=10,gap=5}={}){
 const paper=PAPER[orientation];
 const programs=page.blocks.filter(b=>b.type==='program');
 if(!programs.length)return page;
 const cols=orientation==='landscape'?(programs.length<=4?2:3):2;
 const rows=Math.ceil(programs.length/cols);
 const w=(paper.w-margin*2-gap*(cols-1))/cols,h=(paper.h-top-bottom-gap*(rows-1))/rows;
 programs.forEach((b,i)=>{Object.assign(b,{x:round(margin+(i%cols)*(w+gap)),y:round(top+Math.floor(i/cols)*(h+gap)),w:round(w),h:round(h),rot:0});});
 return page;
}
const round=n=>Math.round(n*10)/10;

// Saved files come from users; accept only known shapes, numbers and image data URLs.
const IMAGE=/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const COLOR=/^#[0-9a-fA-F]{6}$/;
const safeColor=(v,fallback)=>COLOR.test(v)?v:fallback;
const safeUrl=v=>{try{const u=new URL(String(v));return ['https:','http:'].includes(u.protocol)?u.href.slice(0,500):'';}catch{return '';}};
export function sanitizeDocument(input){
 const orientation=input?.orientation==='portrait'?'portrait':'landscape',paper=PAPER[orientation];
 const pages=(Array.isArray(input?.pages)?input.pages:[]).slice(0,12).map(p=>({
  id:text(p.id,40)||uid('page'),
  background:p.background&&IMAGE.test(p.background.src||'')?{src:p.background.src,name:text(p.background.name,120)}:null,
  blocks:(Array.isArray(p.blocks)?p.blocks:[]).filter(b=>TYPES.includes(b?.type)).slice(0,300).map(b=>sanitizeBlock(b,paper)).filter(Boolean),
 }));
 return {version:1,title:text(input?.title,120)||'チラシ',orientation,pages:pages.length?pages:[newPage()]};
}
function sanitizeBlock(b,paper){
 const d=b.data||{},base={id:text(b.id,60)||uid('b'),type:b.type,x:clamp(b.x,-paper.w,paper.w*2),y:clamp(b.y,-paper.h,paper.h*2),w:clamp(b.w,2,paper.w*2),h:clamp(b.h,2,paper.h*2),rot:clamp(b.rot,-180,180)};
 switch(b.type){
  case 'program':return {...base,data:{title:text(d.title,200),catch:text(d.catch,400),body:text(d.body,1200),amount:text(d.amount,80),amountNote:text(d.amountNote,400),period:text(d.period,120),contact:text(d.contact,120),tel:text(d.tel,60),url:safeUrl(d.url),source:d.source?{title:text(d.source.title,200),url:safeUrl(d.source.url),area:text(d.source.area,200)}:null,draft:Boolean(d.draft),color:safeColor(d.color,'#e2701e'),scale:clamp(d.scale??1,.5,2)}};
  case 'heading':return {...base,data:{text:text(d.text,120),color:safeColor(d.color,'#e2701e')}};
  case 'text':return {...base,data:{text:text(d.text,3000),size:clamp(d.size,2,40),color:safeColor(d.color,'#333333'),bold:Boolean(d.bold),align:['left','center','right'].includes(d.align)?d.align:'left'}};
  case 'stamp':return {...base,data:{text:text(d.text,40),color:safeColor(d.color,'#d7262e'),shape:d.shape==='circle'?'circle':'rect'}};
  case 'image':return IMAGE.test(d.src||'')?{...base,data:{src:d.src}}:null;
  case 'qr':return {...base,data:{url:safeUrl(d.url),caption:text(d.caption,40)}};
  case 'box':return {...base,data:{fill:safeColor(d.fill,'#ffffff'),border:safeColor(d.border,'#ffffff')}};
 }
 return null;
}

// Search across Kochi-usable programs and other-area examples.
export function searchRecords(records,query,scope='all'){
 // Same matching as the main search (synonyms such as 産業団地＝工業団地＝企業立地, extracted body text).
 return records.filter(r=>(scope==='all'||(scope==='kochi'?!r.outside_reason:Boolean(r.outside_reason)))&&queryMatches({...r,purposes:r.purposes||[],audiences:r.audiences||[]},query||''));
}
