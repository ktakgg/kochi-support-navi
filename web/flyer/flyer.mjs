import {PAPER,STAMPS,COLORS,DRAFT_NOTE,newDocument,newPage,templateDocument,programBlock,emptyProgram,stampBlock,headingBlock,textBlock,boxBlock,qrBlock,imageBlock,replaceContent,autoLayout,arrange,programLook,isDesigned,findFreeSpot,sendToExtra,layoutExtra,EXTRA_GRID,sanitizeDocument,searchRecords,uid} from './model.mjs';
import {kochiBusinessFlyer} from './templates.mjs';

const $=s=>document.querySelector(s);
const MM=96/25.4; // CSS px per mm
const STORE='kochi-flyer-v1';
const el=(tag,attrs={},...children)=>{const n=document.createElement(tag);for(const [k,v] of Object.entries(attrs)){if(k==='class')n.className=v;else if(k==='text')n.textContent=v;else if(k.startsWith('on'))n.addEventListener(k.slice(2),v);else if(v!==false&&v!=null)n.setAttribute(k,v===true?'':v);}for(const c of children)if(c!=null)n.append(c);return n;};

let doc=load()||sanitizeDocument(kochiBusinessFlyer());
let selected=null; // {page,id}
let history=[];let records=[];let editing=false;

// ---------- persistence ----------
function load(){try{const raw=localStorage.getItem(STORE);return raw?sanitizeDocument(JSON.parse(raw)):null;}catch{return null;}}
let saveTimer;
function persist(){
 clearTimeout(saveTimer);
 saveTimer=setTimeout(()=>{try{localStorage.setItem(STORE,JSON.stringify(doc));status('このブラウザに自動保存しました');}catch{status('自動保存できません（画像が大きい可能性）。「保存」でファイルに保存してください。',true);}},400);
}
function snapshot(){history.push(JSON.stringify(doc));if(history.length>60)history.shift();}
function commit(){persist();render();}
let lastMessage='';
function status(message,warn=false){lastMessage=warn?lastMessage:message;const s=$('#status');s.textContent=warn&&lastMessage?lastMessage+' ／ '+message:message;s.classList.toggle('warn',warn);}

// ---------- helpers ----------
const paper=()=>PAPER[doc.orientation];
const pageOf=id=>doc.pages.find(p=>p.id===id);
const blockOf=()=>selected&&pageOf(selected.page)?.blocks.find(b=>b.id===selected.id);
function center(w=0,h=0,page){
 const b=blockOf();
 if(b&&(!page||selected.page===page.id))return {x:b.x+b.w/2-w/2,y:b.y+b.h/2-h/2};
 return {x:paper().w/2-w/2,y:paper().h/2-h/2};
}
function activePage(){return pageOf(selected?.page)||doc.pages[doc.pages.length-1];}
// Put a new program slot where it fits: an empty area of a designed page, or the continuation page.
function placeProgram(blk,page=activePage(),message=''){
 snapshot();
 if(page.kind==='extra'&&page.blocks.filter(b=>b.type==='program').length<EXTRA_GRID[doc.orientation].cols*EXTRA_GRID[doc.orientation].rows){page.blocks.push(blk);layoutExtra(page,doc.orientation);selected={page:page.id,id:blk.id};commit();status(message+'「その他の支援制度」ページに追加しました。');return;}
 if(isDesigned(page)){
  const spot=findFreeSpot(page,blk.w,blk.h,doc.orientation);
  if(spot){Object.assign(blk,spot);blk.loose=false;page.blocks.push(blk);selected={page:page.id,id:blk.id};commit();status(message+'空いている場所に追加しました。');return;}
  const extra=sendToExtra(doc,blk);selected={page:extra.id,id:blk.id};commit();
  status(message+'このページに空きがないため「その他の支援制度」ページ（'+(doc.pages.indexOf(extra)+1)+'枚目）に追加しました。既存の枠を選んで「この枠と入れ替え」を使うと、同じ場所で中身だけ差し替えられます。');
  document.querySelectorAll('.page-wrap')[doc.pages.indexOf(extra)]?.scrollIntoView({behavior:'smooth',block:'start'});return;
 }
 const at=center(blk.w,blk.h,page);Object.assign(blk,{x:Math.max(0,at.x),y:Math.max(0,at.y)});page.blocks.push(blk);selected={page:page.id,id:blk.id};commit();status(message+'チラシに追加しました。「制度の枠を自動配置」で並べられます。');
}
function addBlock(block,page=activePage()){snapshot();page.blocks.push(block);selected={page:page.id,id:block.id};commit();}

function qrSvg(url){
 if(!url||typeof qrcode!=='function')return null;
 try{const q=qrcode(0,'M');q.addData(url,'Byte');q.make();
  const wrap=document.createElement('div');wrap.innerHTML=q.createSvgTag({cellSize:2,margin:0,scalable:true});return wrap.firstElementChild;}
 catch{return null;}
}

// ---------- rendering ----------
let zoom=1;
function fitZoom(){
 const v=$('#zoom').value,avail=$('#canvas').clientWidth-48;
 return v==='fit'?Math.max(.2,Math.min(1.2,avail/(paper().w*MM))):Number(v);
}
function render(){
 zoom=fitZoom();
 $('#page-size').textContent=`@page{size:A3 ${doc.orientation};margin:0}`;
 $('#doc-title').value=doc.title;
 const pages=$('#pages');pages.replaceChildren();
 doc.pages.forEach((page,i)=>pages.append(renderPage(page,i)));
 renderProps();
 requestAnimationFrame(checkOverflow);
}
function renderPage(page,index){
 const {w,h}=paper();
 const sheet=el('div',{class:'sheet','data-page':page.id,style:`width:${w}mm;height:${h}mm;transform:scale(${zoom})`});
 if(page.background)sheet.append(el('img',{class:'bg',src:page.background.src,alt:''}));
 page.blocks.forEach(b=>sheet.append(renderBlock(b,page)));
 sheet.addEventListener('pointerdown',e=>{if(e.target===sheet||e.target.classList.contains('bg')){selected=null;editing=false;render();}});
 const head=el('div',{class:'page-head'},el('b',{text:`${index+1}枚目（A3${doc.orientation==='landscape'?'横':'縦'}）`}),
  el('span',{},
   el('button',{type:'button',title:isDesigned(page)?'ひな形の配置はそのままにして、新しく追加した枠だけを空いている場所（なければ追加ページ）へ移します':'制度の枠を格子状に並べます',onclick:()=>{snapshot();const r=arrange(doc,index);commit();status(isDesigned(page)?(r.moved||r.overflow?`新しい枠を整理しました（このページ：${r.moved}件、追加ページへ：${r.overflow}件）。ひな形の枠は動かしていません。`:'動かす必要のある新しい枠はありません。ひな形の枠はそのままです。'):'制度の枠を自動で並べました');}},'制度の枠を自動配置'),' ',
   page.background?el('button',{type:'button',onclick:()=>{snapshot();page.background=null;commit();}},'元のチラシ画像を外す'):null,' ',
   index>0?el('button',{type:'button',onclick:()=>movePage(index,-1)},'↑'):null,' ',
   index<doc.pages.length-1?el('button',{type:'button',onclick:()=>movePage(index,1)},'↓'):null,' ',
   doc.pages.length>1?el('button',{type:'button',onclick:()=>{if(confirm(`${index+1}枚目を削除しますか？`)){snapshot();doc.pages.splice(index,1);selected=null;commit();}}},'ページ削除'):null));
 return el('div',{class:'page-wrap'},head,el('div',{class:'sheet-box',style:`width:${w*MM*zoom}px;height:${h*MM*zoom}px`},sheet));
}
function movePage(i,d){snapshot();const [p]=doc.pages.splice(i,1);doc.pages.splice(i+d,0,p);commit();}

function field(tag,cls,name,value,block){
 const n=el(tag,{class:cls,'data-field':name});n.textContent=value||'';
 return n;
}
// Emphasise figures in amounts (補助率 1/2・10万円) as on printed flyers. Text only, never HTML.
function emphasized(cls,name,value){
 const n=el('div',{class:cls,'data-field':name});
 for(const part of String(value||'').split(/([0-9０-９][0-9０-９,，.．/／]*)/))if(part)n.append(/^[0-9０-９]/.test(part)?el('span',{class:'num',text:part}):document.createTextNode(part));
 return n;
}
const SHAPE_SVG={
 'wave-top':'<svg viewBox="0 0 100 30" preserveAspectRatio="none"><path d="M0 0H100V16C78 30 58 4 32 14S8 24 0 20Z"/></svg>',
 'wave-bottom':'<svg viewBox="0 0 100 30" preserveAspectRatio="none"><path d="M0 30H100V8C80 0 62 22 38 14S10 4 0 12Z"/></svg>',
 'sparkle':'<svg viewBox="0 0 100 100"><path d="M50 0C54 38 62 46 100 50C62 54 54 62 50 100C46 62 38 54 0 50C38 46 46 38 50 0Z"/></svg>',
 'board':'<svg viewBox="0 0 100 60" preserveAspectRatio="none"><rect x="1.5" y="1.5" width="97" height="53" rx="2" fill="#fff" stroke-width="1.2" vector-effect="non-scaling-stroke"/><rect x="0" y="56.5" width="100" height="2" rx=".6"/></svg>',
};
const add=(node,...parts)=>{node.append(...parts.filter(x=>x!=null));return node;};
function renderBlock(b,page){
 const isSel=selected?.id===b.id;
 const d=b.data;
 const extra=b.type==='program'?' '+(d.style||'band'):b.type==='heading'?' '+(d.style||'band'):b.data.shape==='circle'?' circle':'';
 const node=el('div',{class:`blk ${b.type}${extra}${isSel?' selected':''}`,'data-id':b.id,style:`left:${b.x}mm;top:${b.y}mm;width:${b.w}mm;height:${b.h}mm;transform:rotate(${b.rot||0}deg)`});
 if(b.type==='program'){
  node.style.setProperty('--c',d.color);node.style.setProperty('--s',d.scale||1);node.style.setProperty('--a',d.amountColor||'#d7262e');node.style.setProperty('--q',(d.qrSize||17)+'mm');
  const qr=qrSvg(d.url);
  if(d.style==='flyer'){
   add(node,field('div','p-title','title',d.title),d.subtitle?field('div','p-sub','subtitle',d.subtitle):null,d.catch?field('div','p-catch','catch',d.catch):null,d.body?field('div','p-body','body',d.body):null,
    el('div',{class:'p-lower'},d.amount?emphasized('p-amount','amount',d.amount):null,d.amountNote?field('div','p-note','amountNote',d.amountNote):null,d.period?field('div','p-period','period',d.period):null,
     el('div',{class:'p-foot'},field('span','p-contact','contact',d.contact),d.tel?field('span','p-tel','tel','TEL：'+d.tel.replace(/^TEL[：:]\s*/,'')):null)),
    qr?el('div',{class:'p-qr'},qr):null);
  }else{
   add(node,field('div','p-title','title',d.title),
    el('div',{class:'p-main'},el('div',{class:'p-text'},d.subtitle?field('div','p-sub','subtitle',d.subtitle):null,field('div','p-catch','catch',d.catch),field('div','p-body','body',d.body),
      el('div',{class:'p-amount-row'},emphasized('p-amount','amount',d.amount),field('div','p-note','amountNote',d.amountNote))),
     qr?el('div',{class:'p-qr'},qr,el('span',{text:'詳しくはこちら'})):null),
    el('div',{class:'p-foot'},d.period?field('span','p-period','period',d.period):null,field('span','p-contact','contact',d.contact),d.tel?field('span','p-tel','tel','TEL：'+d.tel.replace(/^TEL[：:]\s*/,'')):null));
  }
  if(d.draft)add(node,el('span',{class:'draft-badge',text:'他地域の事例から作成した下書き（要確認）'}));
 }else if(b.type==='heading'){
  node.style.setProperty('--c',d.color);node.style.fontSize=(d.size||5.2)+'mm';
  if(d.style==='slash')add(node,el('span',{class:'h-slash',text:'＼'}),d.accent?field('span','h-accent','accent',d.accent):null,field('span','h-text','text',d.text),el('span',{class:'h-slash',text:'／'}));
  else add(node,field('div','h-text','text',d.text));
 }
 else if(b.type==='text'){
  Object.assign(node.style,{color:d.color,fontSize:d.size+'mm',fontWeight:d.bold?'700':'400',textAlign:d.align,lineHeight:d.line||1.4,letterSpacing:(d.spacing||0)+'em',fontStyle:d.italic?'italic':'normal',borderRadius:(d.radius||0)+'mm'});
  if(d.bg&&d.bg!=='none')node.style.background=d.bg;
  if(d.border&&d.border!=='none')node.style.border='.35mm solid '+d.border;
  if(d.shadow&&d.shadow!=='none')node.style.boxShadow=`1.2mm 1.2mm 0 ${d.shadow}`;
  if(d.vertical)node.classList.add('vertical');
  if(d.font==='hand'||d.font==='gothic')node.classList.add('font-'+d.font);
  if(d.tape&&d.tape!=='none'){node.classList.add('taped');node.style.setProperty('--tape',d.tape);}
  const t=field('div','t-text','text',d.text);
  if(d.underline&&d.underline!=='none')Object.assign(t.style,{textDecoration:'underline',textDecorationColor:d.underline,textDecorationThickness:'.6mm',textUnderlineOffset:'.8mm'});
  add(node,t);
 }
 else if(b.type==='stamp'){node.style.setProperty('--c',d.color);node.style.fontSize=Math.max(2,Math.min(b.h*(d.shape==='circle'?.3:.55),(b.w-5)*(d.shape==='circle'?.75:.95)/Math.max(2,[...d.text].length)))+'mm';add(node,field('div','s-text','text',d.text));}
 else if(b.type==='box'){Object.assign(node.style,{background:d.fill==='none'?'transparent':d.fill,borderColor:d.border==='none'?'transparent':d.border,borderWidth:(d.width??.4)+'mm',borderStyle:d.dash?'dashed':'solid',borderRadius:(d.radius||0)+'mm'});}
 else if(b.type==='shape'){node.style.setProperty('--c',d.color);node.innerHTML=SHAPE_SVG[d.kind]||'';}
 else if(b.type==='qr'){const qr=qrSvg(d.url);add(node,qr||el('span',{text:'URLを入力'}),d.caption?el('span',{text:d.caption}):null);}
 else if(b.type==='image'){add(node,el('img',{src:d.src,alt:''}));}
 add(node,el('span',{class:'handle','data-handle':'1'}));
 node.addEventListener('pointerdown',e=>startDrag(e,b,page,node));
 node.addEventListener('dblclick',e=>startEdit(e,b,node));
 return node;
}
function checkOverflow(){
 let over=0;
 document.querySelectorAll('.blk.program,.blk.text,.blk.heading').forEach(n=>{
  const inner=n.classList.contains('program')?n.querySelector('.p-main'):n;
  // A taped slip draws its tape outside the box on purpose; measure its text instead.
  const t=n.classList.contains('taped')?n.querySelector('.t-text'):null;
  let o=t?t.scrollHeight>n.clientHeight+2:(n.scrollHeight>n.clientHeight+2||(inner&&inner.scrollHeight>inner.clientHeight+2));
  // Flyer-style slots pin the amount and contact to the bottom; the text above must not run into them.
  const lower=n.querySelector(':scope>.p-lower');
  if(lower){const above=[...n.children].filter(c=>c!==lower&&!c.classList.contains('p-qr')&&!c.classList.contains('handle')&&!c.classList.contains('draft-badge')).pop();if(above&&above.getBoundingClientRect().bottom>lower.getBoundingClientRect().top+1)o=true;}
  n.classList.toggle('overflow',o);if(o)over++;
 });
 if(over)status(`文字が枠からあふれている枠が${over}件あります（赤い点線）。枠を広げるか文字を減らしてください。`,true);
}

// ---------- drag, resize, inline edit ----------
function startDrag(e,b,page,node){
 if(editing&&e.target.isContentEditable)return;
 if(e.button!==0)return;
 e.preventDefault();e.stopPropagation();
 const resize=e.target.dataset.handle==='1';
 const wasSelected=selected?.id===b.id;
 if(!wasSelected){selected={page:page.id,id:b.id};editing=false;render();}
 const target=document.querySelector(`.blk[data-id="${CSS.escape(b.id)}"]`)||node;
 const sx=e.clientX,sy=e.clientY,start={x:b.x,y:b.y,w:b.w,h:b.h};let moved=false;
 target.setPointerCapture?.(e.pointerId);
 const move=ev=>{
  const dx=(ev.clientX-sx)/(MM*zoom),dy=(ev.clientY-sy)/(MM*zoom);
  if(!moved&&Math.abs(dx)+Math.abs(dy)<.6)return;
  if(!moved){snapshot();moved=true;}
  const snap=v=>Math.round(v*2)/2;
  if(resize){b.w=Math.max(5,snap(start.w+dx));b.h=Math.max(5,snap(start.h+dy));Object.assign(target.style,{width:b.w+'mm',height:b.h+'mm'});}
  else{b.x=snap(start.x+dx);b.y=snap(start.y+dy);Object.assign(target.style,{left:b.x+'mm',top:b.y+'mm'});}
 };
 const up=()=>{target.removeEventListener('pointermove',move);target.removeEventListener('pointerup',up);target.removeEventListener('pointercancel',up);if(moved){b.loose=false;commit();}};
 target.addEventListener('pointermove',move);target.addEventListener('pointerup',up);target.addEventListener('pointercancel',up);
}
function startEdit(e,b,node){
 const f=e.target.closest('[data-field]');if(!f)return;
 e.stopPropagation();editing=true;snapshot();
 f.contentEditable='true';f.focus();
 const sel=getSelection();sel.selectAllChildren(f);sel.collapseToEnd();
 f.addEventListener('paste',ev=>{ev.preventDefault();document.execCommand('insertText',false,ev.clipboardData.getData('text/plain'));});
 f.addEventListener('blur',()=>{
  let v=f.innerText.replace(/\n$/,'');
  if(f.dataset.field==='tel')v=v.replace(/^TEL[：:]\s*/,'');
  b.data[f.dataset.field]=v;f.contentEditable='false';editing=false;commit();
 },{once:true});
}

// ---------- properties panel ----------
function input(label,value,onChange,{type='text',multiline=false}={}){
 const id=uid('f');
 const control=multiline?el('textarea',{id}):el('input',{id,type});control.value=value??'';
 control.addEventListener('focus',()=>snapshot(),{once:true});
 control.addEventListener('input',()=>{onChange(control.value);persist();renderCanvasOnly();});
 return [el('label',{for:id,text:label}),control];
}
let canvasTimer;
function renderCanvasOnly(){clearTimeout(canvasTimer);canvasTimer=setTimeout(()=>{const props=$('#props');const scroll=props.scrollTop;const active=document.activeElement?.id;const pages=$('#pages');pages.replaceChildren();doc.pages.forEach((p,i)=>pages.append(renderPage(p,i)));props.scrollTop=scroll;if(active)document.getElementById(active)?.focus();requestAnimationFrame(checkOverflow);},120);}
function swatches(current,onPick){
 return el('div',{class:'swatches'},...COLORS.map(c=>el('button',{type:'button','aria-label':'色 '+c,'aria-pressed':String(c===current),style:`background:${c}`,onclick:()=>{snapshot();onPick(c);commit();}})));
}
function renderProps(){
 const p=$('#props'),b=blockOf();
 if(!b){p.replaceChildren(el('h2',{text:'使い方'}),el('div',{class:'empty'},
  el('p',{text:'① 左の「制度を探す」で制度を選び「追加」。他地域の事例は高知市版の下書きとして入ります。'}),
  el('p',{text:'② 枠はドラッグで移動、右下の青い丸でサイズ変更、文字はダブルクリックで直接編集できます。'}),
  el('p',{text:'③ 元のチラシ（PowerPointから書き出したPDF）を「元のチラシを読み込む」で開くと、スタンプや差し替えができます。'}),
  el('p',{text:'④ 「A3で印刷・PDF出力」で用紙サイズA3を選んで出力します（余白なし・背景のグラフィックをオン）。'})));return;}
 const d=b.data,names={program:'制度の枠',heading:'見出し帯',text:'文字',stamp:'スタンプ',box:'白い四角',qr:'二次元コード',image:'画像'};
 const parts=[el('h2',{text:names[b.type]})];
 if(b.type==='program'){
  if(d.draft)parts.push(el('div',{class:'warn-box',text:DRAFT_NOTE}));
  parts.push(...input('制度名',d.title,v=>d.title=v),...input('キャッチコピー',d.catch,v=>d.catch=v,{multiline:true}),...input('内容・対象',d.body,v=>d.body=v,{multiline:true}),
   ...input('金額（大きく表示）',d.amount,v=>d.amount=v),...input('金額の補足',d.amountNote,v=>d.amountNote=v,{multiline:true}),...input('受付期間',d.period,v=>d.period=v),
   ...input('担当課',d.contact,v=>d.contact=v),...input('電話番号',d.tel,v=>d.tel=v),...input('二次元コードのURL',d.url,v=>d.url=v,{type:'url'}));
  const sizeId=uid('f');const size=el('select',{id:sizeId},...[[.8,'小さめ'],[.9,'やや小さめ'],[1,'標準'],[1.15,'やや大きめ'],[1.3,'大きめ']].map(([v,t])=>el('option',{value:v,selected:Number(d.scale||1)===v},t)));
  size.addEventListener('change',()=>{snapshot();d.scale=Number(size.value);commit();});
  parts.push(el('label',{for:sizeId,text:'文字の大きさ'}),size,el('label',{text:'色'}),swatches(d.color,c=>d.color=c));
  if(d.draft)parts.push(el('label',{},el('input',{type:'checkbox',checked:false,onchange:e=>{if(e.target.checked){snapshot();d.draft=false;commit();}}}),' 内容を確定した（下書き表示を消す）'));
  if(d.source)parts.push(el('div',{class:'source'},'元にした制度：'+d.source.title+(d.source.area?`（${d.source.area}）`:''),el('br'),d.source.url?el('a',{href:d.source.url,target:'_blank',rel:'noopener'},'公式情報を開く'):null));
 }else if(b.type==='heading'){parts.push(...input('文字',d.text,v=>d.text=v),el('label',{text:'色'}),swatches(d.color,c=>d.color=c));}
 else if(b.type==='text'){
  parts.push(...input('文字',d.text,v=>d.text=v,{multiline:true}),...input('文字の大きさ（mm）',d.size,v=>d.size=Math.max(2,Math.min(40,Number(v)||5)),{type:'number'}),
   el('label',{},el('input',{type:'checkbox',checked:d.bold,onchange:e=>{snapshot();d.bold=e.target.checked;commit();}}),' 太字'),
   el('label',{text:'そろえ'}),el('div',{class:'swatches'},...[['left','左'],['center','中央'],['right','右']].map(([v,t])=>el('button',{type:'button','aria-pressed':String(d.align===v),style:'width:auto;border-radius:5px;padding:0 8px;background:#fff',onclick:()=>{snapshot();d.align=v;commit();}},t))),
   el('label',{text:'色'}),swatches(d.color,c=>d.color=c),
   el('label',{text:'書体'}),el('div',{class:'swatches'},...[['maru','丸ゴシック'],['gothic','ゴシック'],['hand','手書き風']].map(([v,t])=>el('button',{type:'button','aria-pressed':String((d.font||'maru')===v),style:'width:auto;border-radius:5px;padding:0 8px;background:#fff',onclick:()=>{snapshot();d.font=v;commit();}},t))),
   el('label',{text:'背景'}),swatches(d.bg,c=>d.bg=d.bg===c?'none':c),
   el('label',{},el('input',{type:'checkbox',checked:d.tape&&d.tape!=='none',onchange:e=>{snapshot();d.tape=e.target.checked?'#e2701e':'none';if(e.target.checked&&(!d.bg||d.bg==='none'))d.bg='#ffffff';commit();}}),' 吹き出し札（テープ付き）'));
 }else if(b.type==='stamp'){parts.push(...input('スタンプの文字',d.text,v=>d.text=v),el('label',{text:'色'}),swatches(d.color,c=>d.color=c),
  el('label',{},el('input',{type:'checkbox',checked:d.shape==='circle',onchange:e=>{snapshot();d.shape=e.target.checked?'circle':'rect';commit();}}),' 丸型'));}
 else if(b.type==='box'){parts.push(el('label',{text:'塗り'}),swatches(d.fill,c=>{d.fill=c;d.border=c;}),el('p',{class:'hint',text:'元のチラシの不要な部分を隠すときに使います。白以外の色も選べます。'}));
  parts.push(el('button',{type:'button',class:'btn',onclick:()=>{snapshot();d.fill='#ffffff';d.border='#ffffff';commit();}},'白に戻す'));}
 else if(b.type==='qr'){parts.push(...input('URL',d.url,v=>d.url=v,{type:'url'}),...input('下の文字',d.caption,v=>d.caption=v));}
 const pos=[['x','左(mm)'],['y','上(mm)'],['w','幅(mm)'],['h','高さ(mm)']].map(([k,t])=>{const n=el('input',{type:'number',step:'0.5',value:b[k],'aria-label':t});n.addEventListener('change',()=>{snapshot();b[k]=Number(n.value)||0;commit();});return el('div',{},el('span',{text:t}),n);});
 const rot=el('input',{type:'number',step:'1',value:b.rot||0,'aria-label':'回転(度)'});rot.addEventListener('change',()=>{snapshot();b.rot=Number(rot.value)||0;commit();});
 parts.push(el('label',{text:'位置と大きさ（A3上の実寸）'}),el('div',{class:'row'},...pos),el('label',{text:'回転（度）'}),rot);
 const page=pageOf(selected.page);
 parts.push(el('div',{class:'actions'},
  b.type!=='stamp'?el('button',{type:'button',class:'wide',onclick:()=>{const s=stampBlock(STAMPS[0]);s.w=Math.min(b.w*.85,150);s.h=Math.min(Math.max(14,b.h*.28),40);Object.assign(s,{x:b.x+(b.w-s.w)/2,y:b.y+(b.h-s.h)/2});addBlock(s,page);status('「受付終了しました」を押しました');}},'この枠に「受付終了しました」を押す'):null,
  el('button',{type:'button',onclick:()=>{snapshot();page.blocks=page.blocks.filter(x=>x.id!==b.id);page.blocks.push(b);commit();}},'いちばん前へ'),
  el('button',{type:'button',onclick:()=>{snapshot();page.blocks=page.blocks.filter(x=>x.id!==b.id);page.blocks.unshift(b);commit();}},'いちばん後ろへ'),
  el('button',{type:'button',onclick:()=>{const c=structuredClone(b);c.id=uid('b');c.x+=5;c.y+=5;addBlock(c,page);}},'複製'),
  el('button',{type:'button',class:'danger',onclick:removeSelected},'削除')));
 if(b.type==='program')parts.push(el('p',{class:'hint',text:'中身を交換するには、この枠を選んだまま左の検索結果で「この枠と入れ替え」を押します。位置と大きさはそのまま残ります。'}));
 p.replaceChildren(...parts);
}
function removeSelected(){const b=blockOf();if(!b)return;snapshot();const page=pageOf(selected.page);page.blocks=page.blocks.filter(x=>x.id!==b.id);selected=null;commit();}

// ---------- search ----------
async function loadRecords(){
 const base=new URL('../',import.meta.url);
 const [pub,ex]=await Promise.all([fetch(new URL('data.json',base)).then(r=>r.json()),fetch(new URL('flyer/examples.json',base)).then(r=>r.ok?r.json():{records:[]}).catch(()=>({records:[]}))]);
 records=[...pub.records,...ex.records];renderResults();
}
function renderResults(){
 const scope=document.querySelector('input[name=scope]:checked').value,q=$('#q').value;
 const list=searchRecords(records,q,scope);const b=blockOf();
 $('#search-hint').textContent=`${list.length}件${list.length>60?'（上位60件を表示）':''}。`+(scope!=='kochi'?'他地域の事例は、地名を高知市に置き換えた下書きとして追加します。':'');
 $('#results').replaceChildren(...list.slice(0,60).map(r=>el('li',{},
  el('div',{class:'r-title'},r.outside_reason?el('span',{class:'r-example',text:'他地域の事例'}):null,r.title),
  el('div',{class:'r-meta',text:[r.source_name,r.target_area&&r.outside_reason?r.target_area:null,r.amount?String(r.amount).split('\n')[0].slice(0,40):null].filter(Boolean).join(' ／ ')}),
  el('div',{class:'r-actions'},
   el('button',{type:'button',onclick:()=>{placeProgram(programBlock(r,{x:12,y:40},undefined,programLook(doc)),activePage(),r.outside_reason?'高知市版の下書きとして':'');}},'チラシに追加'),
   b?.type==='program'?el('button',{type:'button',class:'swap',onclick:()=>{snapshot();const page=pageOf(selected.page);const i=page.blocks.findIndex(x=>x.id===b.id);page.blocks[i]=replaceContent(b,r);commit();status('選んだ枠の中身を入れ替えました');}},'この枠と入れ替え'):null,
   r.url?el('a',{href:r.url,target:'_blank',rel:'noopener',style:'font-size:11.5px;color:#a32126;align-self:center'},'公式情報'):null))));
}

// ---------- import / export ----------
function readAsDataURL(file){return new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.onerror=rej;fr.readAsDataURL(file);});}
async function downscale(src,max=3200,type='image/jpeg'){
 const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=src;});
 const s=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));const c=document.createElement('canvas');c.width=Math.round(img.naturalWidth*s);c.height=Math.round(img.naturalHeight*s);
 const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.drawImage(img,0,0,c.width,c.height);
 return {src:c.toDataURL(type,.86),landscape:c.width>=c.height};
}
async function importFlyer(file){
 status('読み込み中…');
 const pages=[];
 if(file.type==='application/pdf'){
  const pdfjs=await import(new URL('../vendor/pdfjs/pdf.min.mjs',import.meta.url).href);
  pdfjs.GlobalWorkerOptions.workerSrc=new URL('../vendor/pdfjs/pdf.worker.min.mjs',import.meta.url).href;
  const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),cMapUrl:new URL('../vendor/pdfjs/cmaps/',import.meta.url).href,cMapPacked:true,standardFontDataUrl:new URL('../vendor/pdfjs/standard_fonts/',import.meta.url).href,isEvalSupported:false}).promise;
  for(let n=1;n<=Math.min(pdf.numPages,12);n++){
   const pg=await pdf.getPage(n),v=pg.getViewport({scale:1}),scale=3200/Math.max(v.width,v.height),vp=pg.getViewport({scale});
   const c=document.createElement('canvas');c.width=Math.round(vp.width);c.height=Math.round(vp.height);
   await pg.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;
   pages.push({src:c.toDataURL('image/jpeg',.86),landscape:vp.width>=vp.height});status(`読み込み中… ${n}/${pdf.numPages}ページ`);
  }
 }else pages.push(await downscale(await readAsDataURL(file)));
 snapshot();
 const empty=doc.pages.length===1&&!doc.pages[0].blocks.length&&!doc.pages[0].background;
 if(empty)doc.pages=[];
 if(empty||confirm('今のチラシの後ろにページとして追加します。よろしいですか？（キャンセルで中止）')){
  if(empty)doc.orientation=pages[0].landscape?'landscape':'portrait';
  for(const p of pages)doc.pages.push(newPage({src:p.src,name:file.name.slice(0,120)}));
  if(empty)doc.title=file.name.replace(/\.[^.]+$/,'').slice(0,120);
  selected=null;commit();status(`${pages.length}ページを読み込みました。スタンプや白い四角・制度の枠を重ねて編集できます。`);
 }else{history.pop();status('');}
}
function download(){
 const blob=new Blob([JSON.stringify(doc)],{type:'application/json'});const a=el('a',{href:URL.createObjectURL(blob),download:(doc.title||'チラシ')+'.json'});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
 status('ファイルに保存しました。「開く」で続きから編集できます。');
}

// ---------- wiring ----------
$('#stamps').append(...STAMPS.map(s=>el('button',{type:'button',style:`color:${s.color}`,onclick:()=>{const b=stampBlock(s);const at=center(b.w,b.h);Object.assign(b,at);addBlock(b);}},s.text)));
document.querySelectorAll('[data-part]').forEach(btn=>btn.addEventListener('click',()=>{
 if(btn.dataset.part==='program')return placeProgram(emptyProgram({x:12,y:40},programLook(doc)));
 const make={heading:()=>headingBlock(),text:()=>textBlock(),qr:()=>qrBlock(),box:()=>boxBlock()}[btn.dataset.part]();
 const at=center(make.w,make.h);Object.assign(make,{x:Math.max(0,at.x),y:Math.max(0,at.y)});selected=null;addBlock(make);
}));
$('#add-image').addEventListener('change',async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;const img=await downscale(await readAsDataURL(f),1800,f.type==='image/png'?'image/png':'image/jpeg');addBlock(imageBlock(img.src,center(60,40),60,40));});
document.querySelectorAll('[role=tab]').forEach(t=>t.addEventListener('click',()=>{document.querySelectorAll('[role=tab]').forEach(x=>x.setAttribute('aria-selected',String(x===t)));$('#tab-search').hidden=t.dataset.tab!=='search';$('#tab-parts').hidden=t.dataset.tab!=='parts';}));
$('#q').addEventListener('input',renderResults);
document.querySelectorAll('input[name=scope]').forEach(r=>r.addEventListener('change',renderResults));
$('[data-menu=new]').addEventListener('click',()=>{$('#menu-new').hidden=!$('#menu-new').hidden;});
document.addEventListener('click',e=>{if(!e.target.closest('.menu'))$('#menu-new').hidden=true;});
document.querySelectorAll('[data-new]').forEach(b=>b.addEventListener('click',()=>{
 if(!confirm('今のチラシを閉じて新しく作ります。保存していない内容は失われます。よろしいですか？'))return;
 snapshot();const [kind,orientation]=b.dataset.new.split('-');doc=kind==='kochi'?sanitizeDocument(kochiBusinessFlyer()):kind==='template'?templateDocument(orientation):newDocument(orientation);selected=null;$('#menu-new').hidden=true;commit();
}));
$('#import-flyer').addEventListener('change',e=>{const f=e.target.files[0];e.target.value='';if(f)importFlyer(f).catch(err=>status('読み込めませんでした：'+err.message,true));});
$('#open-file').addEventListener('change',async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{snapshot();doc=sanitizeDocument(JSON.parse(await f.text()));selected=null;commit();status('保存したチラシを開きました');}catch{status('チラシのファイルとして読み込めませんでした',true);}});
$('#save-file').addEventListener('click',download);
$('#add-page').addEventListener('click',()=>{snapshot();const p=newPage();doc.pages.push(p);selected=null;commit();});
$('#undo').addEventListener('click',undo);
function undo(){const last=history.pop();if(!last)return status('これ以上戻せません');doc=sanitizeDocument(JSON.parse(last));selected=null;commit();}
$('#print').addEventListener('click',async()=>{selected=null;render();await document.fonts.ready;status('印刷画面で用紙サイズ「A3」、余白「なし」、「背景のグラフィック」をオンにしてください。PDFにする場合は送信先で「PDFに保存」を選びます。');setTimeout(()=>window.print(),300);});
$('#doc-title').addEventListener('input',e=>{doc.title=e.target.value;persist();});
$('#zoom').addEventListener('change',render);
addEventListener('resize',()=>{if($('#zoom').value==='fit')render();});
document.addEventListener('keydown',e=>{
 if(editing||/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName))return;
 const b=blockOf();
 if((e.ctrlKey||e.metaKey)&&e.key==='z'){e.preventDefault();undo();return;}
 if(!b)return;
 if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();removeSelected();}
 const step=e.shiftKey?5:.5,moves={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]};
 if(moves[e.key]){e.preventDefault();snapshot();b.x+=moves[e.key][0];b.y+=moves[e.key][1];commit();}
 if((e.ctrlKey||e.metaKey)&&e.key==='d'){e.preventDefault();const c=structuredClone(b);c.id=uid('b');c.x+=5;c.y+=5;addBlock(c,pageOf(selected.page));}
});
// ---------- QR code maker ----------
function validUrl(v){try{const u=new URL(v.trim());return ['http:','https:'].includes(u.protocol)?u.href:'';}catch{return '';}}
function qrUpdate(){
 const url=validUrl($('#qr-url').value),box=$('#qr-preview');
 box.replaceChildren(url?(qrSvg(url)||el('span',{class:'hint',text:'長すぎてコードにできません'})):el('span',{class:'hint',text:$('#qr-url').value?'http(s):// で始まるURLを入力してください':'URLを入力してください'}));
 $('#qr-to-program').hidden=blockOf()?.type!=='program';
 return url;
}
$('#qr-open').addEventListener('click',()=>{const b=blockOf();$('#qr-url').value=b?.data?.url||'';$('#qr-caption').value=b?.type==='qr'?b.data.caption:'詳しくはこちら';$('#qr-message').textContent='';qrUpdate();$('#qr-dialog').showModal();$('#qr-url').focus();});
$('#qr-url').addEventListener('input',qrUpdate);
$('#qr-close').addEventListener('click',()=>$('#qr-dialog').close());
$('#qr-place').addEventListener('click',()=>{const url=qrUpdate();if(!url)return;const b=qrBlock(url);b.data.caption=$('#qr-caption').value.slice(0,40);b.h=b.data.caption?26:22;const at=center(b.w,b.h);Object.assign(b,{x:Math.max(0,at.x),y:Math.max(0,at.y)});selected=null;addBlock(b);$('#qr-dialog').close();status('QRコードを配置しました。ドラッグで移動、右下の丸で大きさを変えられます。');});
$('#qr-to-program').addEventListener('click',()=>{const url=qrUpdate(),b=blockOf();if(!url||b?.type!=='program')return;snapshot();b.data.url=url;commit();$('#qr-dialog').close();status('選んだ制度の枠にQRコードを設定しました');});
$('#qr-download').addEventListener('click',()=>{
 const url=qrUpdate();if(!url)return;
 const q=qrcode(0,'M');q.addData(url,'Byte');q.make();
 const n=q.getModuleCount(),cell=12,margin=4,c=document.createElement('canvas');c.width=c.height=(n+margin*2)*cell;
 const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.fillStyle='#000';
 for(let r=0;r<n;r++)for(let k=0;k<n;k++)if(q.isDark(r,k))g.fillRect((k+margin)*cell,(r+margin)*cell,cell,cell);
 const a=el('a',{href:c.toDataURL('image/png'),download:'qrcode.png'});document.body.append(a);a.click();a.remove();
 $('#qr-message').textContent='PNG画像を保存しました（印刷向けの高解像度）。';
});

render();
loadRecords().catch(()=>{$('#search-hint').textContent='制度データを読み込めませんでした。';});
