import {PAPER,STAMPS,COLORS,DRAFT_NOTE,newDocument,newPage,templateDocument,programBlock,emptyProgram,stampBlock,headingBlock,textBlock,boxBlock,qrBlock,imageBlock,replaceContent,swapData,autoLayout,arrange,programLook,isDesigned,findFreeSpot,sendToExtra,layoutExtra,EXTRA_GRID,sanitizeDocument,searchRecords,uid} from './model.mjs';
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
 saveTimer=setTimeout(()=>{try{localStorage.setItem(STORE,JSON.stringify(doc));if(!lastMessage||lastMessage==='このブラウザに自動保存しました')status('このブラウザに自動保存しました');}catch{status('自動保存できません（画像が大きい可能性）。「保存」でファイルに保存してください。',true);}},400);
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
// ---------- click to choose where a new slot goes ----------
let pending=null; // {block,message}
function startPlacement(block,message=''){
 pending={block,message};document.body.classList.add('placing');
 $('#place-text').textContent=`「${(block.data.title||'制度の枠').split('\n')[0].slice(0,30)}」を置く場所をクリックしてください。既存の制度の枠をクリックすると、その枠の見た目のまま中身を入れ替えます。`;
 $('#place-banner').hidden=false;
}
function cancelPlacement(){pending=null;document.body.classList.remove('placing');$('#place-banner').hidden=true;document.querySelectorAll('.ghost').forEach(g=>g.remove());document.querySelectorAll('.swap-target').forEach(n=>n.classList.remove('swap-target'));}
// The program slot under the pointer, even when a sticker or illustration sits on top of it.
function slotAt(page,m){return [...page.blocks].reverse().find(b=>b.type==='program'&&m.x>=b.x&&m.x<=b.x+b.w&&m.y>=b.y&&m.y<=b.y+b.h)||null;}
// Shrink the wording of a slot step by step until it fits (down to 60%), after new text arrives.
function autoFit(id){
 requestAnimationFrame(()=>{
  const b=doc.pages.flatMap(p=>p.blocks).find(x=>x.id===id);if(!b||b.type!=='program')return;
  const node=()=>document.querySelector(`.blk[data-id="${CSS.escape(id)}"]`);
  const over=n=>n&&(n.scrollHeight>n.clientHeight+2);
  let n=node(),scale=b.data.scale||1;
  while(over(n)&&scale>.62){scale=Math.round((scale-.04)*100)/100;n.style.setProperty('--s',scale);}
  if(scale!==(b.data.scale||1)){b.data.scale=scale;persist();checkOverflow();status(lastMessage+(over(n)?'':'（文字の大きさを'+Math.round(scale*100)+'%に自動調整しました）'));}
 });
}
function pointerMm(e,sheet){const r=sheet.getBoundingClientRect();return {x:(e.clientX-r.left)/(MM*zoom),y:(e.clientY-r.top)/(MM*zoom)};}
function placementMove(e,sheet){
 if(!pending)return;
 const page=pageOf(sheet.dataset.page),hit=page&&slotAt(page,pointerMm(e,sheet));
 const slot=hit?sheet.querySelector(`.blk[data-id="${CSS.escape(hit.id)}"]`):null;
 document.querySelectorAll('.swap-target').forEach(n=>n!==slot&&n.classList.remove('swap-target'));
 let g=sheet.querySelector('.ghost');
 if(slot){slot.classList.add('swap-target');g?.remove();return;}
 if(!g){g=el('div',{class:'ghost'});sheet.append(g);}
 const b=pending.block,{w,h}=paper(),m=pointerMm(e,sheet);
 Object.assign(g.style,{left:Math.min(w-b.w,Math.max(0,m.x-b.w/2))+'mm',top:Math.min(h-b.h,Math.max(0,m.y-b.h/2))+'mm',width:b.w+'mm',height:b.h+'mm'});
}
function placementClick(e,sheet,page){
 if(!pending)return;
 e.preventDefault();e.stopPropagation();
 const {block,message}=pending;cancelPlacement();snapshot();
 const slot=slotAt(page,pointerMm(e,sheet));
 if(slot){const i=page.blocks.indexOf(slot);page.blocks[i]=swapData(slot,block.data);selected={page:page.id,id:slot.id};commit();autoFit(slot.id);status(message+'選んだ枠の中身を入れ替えました（元に戻すで取り消せます）。');return;}
 const {w,h}=paper(),m=pointerMm(e,sheet);
 Object.assign(block,{x:Math.round(Math.min(w-block.w,Math.max(0,m.x-block.w/2))*2)/2,y:Math.round(Math.min(h-block.h,Math.max(0,m.y-block.h/2))*2)/2});block.loose=false;
 page.blocks.push(block);selected={page:page.id,id:block.id};commit();status(message+'クリックした場所に追加しました。ドラッグで微調整できます。');autoFit(block.id);
}
$('#place-cancel').addEventListener('click',cancelPlacement);
$('#place-auto').addEventListener('click',()=>{if(!pending)return;const {block,message}=pending;cancelPlacement();placeProgram(block,activePage(),message);});
$('#place-extra').addEventListener('click',()=>{if(!pending)return;const {block,message}=pending;cancelPlacement();snapshot();const extra=sendToExtra(doc,block);selected={page:extra.id,id:block.id};commit();status(message+'「その他の支援制度」ページに追加しました。');document.querySelectorAll('.page-wrap')[doc.pages.indexOf(extra)]?.scrollIntoView({behavior:'smooth',block:'start'});});
function addBlock(block,page=activePage()){snapshot();page.blocks.push(block);selected={page:page.id,id:block.id};commit();}

// QR code with the 4-module white quiet zone that phone readers need, drawn with crisp module edges.
const SVGNS='http://www.w3.org/2000/svg',QUIET=2;
function qrSvg(url){
 if(!url||typeof qrcode!=='function')return null;
 try{
  // Level L keeps the modules large enough for phones at flyer sizes (15–20mm).
  const q=qrcode(0,'L');q.addData(url,'Byte');q.make();
  const n=q.getModuleCount(),size=n+QUIET*2;let d='';
  for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(q.isDark(r,c))d+=`M${c+QUIET} ${r+QUIET}h1v1h-1z`;
  const svg=document.createElementNS(SVGNS,'svg');
  svg.setAttribute('viewBox',`0 0 ${size} ${size}`);svg.setAttribute('shape-rendering','crispEdges');svg.setAttribute('class','qr-code');
  const bg=document.createElementNS(SVGNS,'rect');bg.setAttribute('width',size);bg.setAttribute('height',size);bg.setAttribute('fill','#ffffff');
  const path=document.createElementNS(SVGNS,'path');path.setAttribute('d',d);path.setAttribute('fill','#000000');
  svg.append(bg,path);return svg;
 }catch{return null;}
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
 sheet.addEventListener('pointerdown',e=>placementClick(e,sheet,page),{capture:true});
 sheet.addEventListener('pointermove',e=>placementMove(e,sheet));
 sheet.addEventListener('pointerleave',()=>sheet.querySelector('.ghost')?.remove());
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

// Inline marks for parts of a line: [赤]12[/赤] [橙]…[/橙] [大]…[/大] [小]…[/小] [太]…[/太]. Rendered as text spans only.
const MARK=/\[(赤|橙|青|緑|白|黒|特大|大|小|極小|太|\d{2,3}%)\]([\s\S]*?)\[\/\1\]/g;
const MARK_CLASS={赤:'m-red',橙:'m-orange',青:'m-blue',緑:'m-green',白:'m-white',黒:'m-black',特大:'m-huge',大:'m-big',小:'m-small',極小:'m-tiny',太:'m-bold'};
// One mark → one span. [150%]…[/150%] sets that part's size relative to the line.
function markSpan(tag){const pct=/^(\d{2,3})%$/.exec(tag);return pct?el('span',{style:`font-size:${Math.min(300,Math.max(30,+pct[1]))}%`}):el('span',{class:MARK_CLASS[tag]});}
function rich(n,value){
 const v=String(value||'');let last=0;
 for(const m of v.matchAll(MARK)){if(m.index>last)n.append(v.slice(last,m.index));n.append(rich(markSpan(m[1]),m[2]));last=m.index+m[0].length;}
 if(last<v.length)n.append(v.slice(last));
 return n;
}
function field(tag,cls,name,value){return rich(el(tag,{class:cls,'data-field':name}),value);}
// Emphasise figures in amounts (補助率 1/2・10万円) as on printed flyers. Text only, never HTML.
function numbers(target,text){for(const part of String(text).split(/([0-9０-９][0-9０-９,，.．/／]*)/))if(part)target.append(/^[0-9０-９]/.test(part)?el('span',{class:'num',text:part}):document.createTextNode(part));return target;}
function emphasizedInto(n,v){let last=0;for(const m of v.matchAll(MARK)){numbers(n,v.slice(last,m.index));n.append(emphasizedInto(markSpan(m[1]),m[2]));last=m.index+m[0].length;}return numbers(n,v.slice(last));}
function emphasized(cls,name,value){
 const n=el('div',{class:cls,'data-field':name}),v=String(value||'');let last=0;
 for(const m of v.matchAll(MARK)){numbers(n,v.slice(last,m.index));n.append(emphasizedInto(markSpan(m[1]),m[2]));last=m.index+m[0].length;}
 return numbers(n,v.slice(last));
}
const SHAPE_SVG={
 'wave-top':'<svg viewBox="0 0 100 30" preserveAspectRatio="none"><path d="M0 0H100V9C74 11 40 19 0 30Z"/></svg>',
 'wave-bottom':'<svg viewBox="0 0 100 30" preserveAspectRatio="none"><path d="M0 30H100V0C70 3 36 11 0 20Z"/></svg>',
 'sparkle':'<svg viewBox="0 0 100 100"><path d="M50 0C54 38 62 46 100 50C62 54 54 62 50 100C46 62 38 54 0 50C38 46 46 38 50 0Z"/></svg>',
};
const add=(node,...parts)=>{node.append(...parts.filter(x=>x!=null));return node;};
// Shapes drawn in real millimetres so strokes keep their thickness at any size (numbers only).
const f=n=>Math.round(n*100)/100;
function drawn(kind,w,h){
 const s=1.1,open=`<svg viewBox="0 0 ${f(w)} ${f(h)}" width="100%" height="100%">`;
 if(kind==='board'){
  const ty=h*.86,th=Math.min(4,h*.05);
  return open+`<rect x="${s/2}" y="${s/2}" width="${f(w-s)}" height="${f(ty-s)}" rx="2.6" fill="#fff" stroke-width="${s}"/>`+
   `<line x1="${s/2}" y1="${f(ty+th)}" x2="${s/2}" y2="${f(h)}" stroke-width="${s}"/><line x1="${f(w-s/2)}" y1="${f(ty+th)}" x2="${f(w-s/2)}" y2="${f(h)}" stroke-width="${s}"/>`+
   `<rect x="${s/2}" y="${f(ty)}" width="${f(w-s)}" height="${f(th)}" rx=".8" fill="#fff" stroke-width="${s}"/>`+
   `<line x1="6" y1="${f(ty+th+2.6)}" x2="${f(w-3)}" y2="${f(ty+th+2.6)}" stroke-width="${s}" stroke-linecap="round"/></svg>`;
 }
 if(kind==='eraser'){
  return open+`<rect x="${s/2}" y="${s/2}" width="${f(w-s)}" height="${f(h-s)}" rx=".5" fill="#fff" stroke-width="${s}"/>`+
   `<rect x="${f(w*.12)}" y="${f(h*.34)}" width="${f(w*.14)}" height="${f(h*.34)}" class="pad"/><rect x="${f(w*.34)}" y="${f(h*.34)}" width="${f(w*.56)}" height="${f(h*.34)}" class="pad"/></svg>`;
 }
 if(kind==='eraser-stack'){
  const top=h*.58;
  return open+`<rect x="${f(w*.04)}" y="${f(top)}" width="${f(w*.92)}" height="${f(h-top-s/2)}" rx=".5" fill="#fff" stroke-width="${s}"/>`+
   `<rect x="0" y="${f(h*.12)}" width="${f(w)}" height="${f(top-h*.12)}" rx=".8" class="fill"/>`+
   `<rect x="${f(w*.36)}" y="0" width="${f(w*.28)}" height="${f(h*.2)}" rx=".6" class="fill"/>`+
   `<rect x="${f(w*.1)}" y="${f(h*.28)}" width="${f(w*.18)}" height="${f(h*.18)}" class="pad"/><rect x="${f(w*.41)}" y="${f(h*.22)}" width="${f(w*.18)}" height="${f(h*.24)}" class="pad"/><rect x="${f(w*.72)}" y="${f(h*.28)}" width="${f(w*.18)}" height="${f(h*.18)}" class="pad"/></svg>`;
 }
 if(kind==='cloud'){
  // Bumps along an ellipse, each drawn as an outward arc.
  const n=Math.max(11,Math.round((w+h)/6.5)),cx=w/2,cy=h/2,rx=w/2-1.6,ry=h/2-1.6,pts=[];
  for(let i=0;i<n;i++){const a=Math.PI*2*i/n-Math.PI/2;pts.push([cx+rx*.9*Math.cos(a),cy+ry*.82*Math.sin(a)]);}
  let d=`M${f(pts[0][0])} ${f(pts[0][1])}`;
  for(let i=1;i<=n;i++){const [x0,y0]=pts[i-1],[x1,y1]=pts[i%n],r=Math.hypot(x1-x0,y1-y0)*.62;d+=`A${f(r)} ${f(r)} 0 0 1 ${f(x1)} ${f(y1)}`;}
  return open+`<path d="${d}Z" class="body"/></svg>`;
 }
 if(kind==='star'||kind==='burst'){
  const n=kind==='star'?5:12,inner=kind==='star'?.45:.72,cx=w/2,cy=h/2,pts=[];
  for(let i=0;i<n*2;i++){const a=Math.PI*i/n-Math.PI/2,r=i%2?inner:1;pts.push(f(cx+cx*.98*r*Math.cos(a))+' '+f(cy+cy*.98*r*Math.sin(a)));}
  return open+`<path d="M${pts.join('L')}Z" class="body"/></svg>`;
 }
 return '';
}
function renderBlock(b,page){
 const isSel=selected?.id===b.id;
 const d=b.data;
 const extra=b.type==='program'?' '+(d.style||'band')+(d.align==='left'?' align-left':'')+(d.pack==='top'?' pack-top':''):b.type==='heading'?' '+(d.style||'band'):b.data.shape==='circle'?' circle':'';
 const node=el('div',{class:`blk ${b.type}${extra}${isSel?' selected':''}`,'data-id':b.id,style:`left:${b.x}mm;top:${b.y}mm;width:${b.w}mm;height:${b.h}mm;transform:rotate(${b.rot||0}deg)`});
 if(b.type==='program'){
  node.style.setProperty('--c',d.color);node.style.setProperty('--s',d.scale||1);node.style.setProperty('--a',d.amountColor||'#d7262e');
  for(const [k,v] of [['--ts',d.titleSize],['--cs',d.catchSize],['--bs',d.bodySize],['--as',d.amountSize],['--bl',d.bodyLine],['--tc',d.titleColor],['--cc',d.catchColor],['--bc',d.bodyColor]])if(v!=null&&v!=='none')node.style.setProperty(k,v);node.style.setProperty('--q',(d.qrSize||17)+'mm');
  const qr=qrSvg(d.url);
  if(d.style==='flyer'){
   // Printed-flyer layout: heading, catch, body, then figures with the QR beside them and the contact line last.
   add(node,add(el('div',{class:'p-head'}),field('div','p-title','title',d.title),d.subtitle?field('div','p-sub','subtitle',d.subtitle):null),
    d.catch?field('div','p-catch','catch',d.catch):null,d.body?field('div','p-body','body',d.body):null,
    add(el('div',{class:'p-lower'}),add(el('div',{class:'p-figures'}),d.amount?emphasized('p-amount','amount',d.amount):null,d.amountNote?field('div','p-note','amountNote',d.amountNote):null,d.period?field('div','p-period','period',d.period):null),
     qr?el('div',{class:'p-qr'},qr):null,
     d.contact||d.tel?add(el('div',{class:'p-foot'}),field('span','p-contact','contact',d.contact),d.tel?field('span','p-tel','tel','TEL：'+d.tel.replace(/^TEL[：:]\s*/,'')):null):null));
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
  node.classList.add('font-'+(d.font||'maru'));
  if(d.tape&&d.tape!=='none'){node.classList.add('taped');node.style.setProperty('--tape',d.tape);}
  if(d.glow&&d.glow!=='none')node.style.textShadow=['0 0 .5mm','0 0 .5mm','.25mm .25mm .3mm'].map(x=>x+' '+d.glow).join(',');
  if(d.notch){node.classList.add('notched');node.style.setProperty('--edge',d.border&&d.border!=='none'?d.border:'#333');}
  const t=field('div','t-text','text',d.text);
  if(d.underline&&d.underline!=='none')Object.assign(t.style,{textDecoration:'underline',textDecorationColor:d.underline,textDecorationThickness:'.6mm',textUnderlineOffset:'.8mm'});
  add(node,t);
 }
 else if(b.type==='stamp'){node.style.setProperty('--c',d.color);node.style.fontSize=Math.max(2,Math.min(b.h*(d.shape==='circle'?.3:.55),(b.w-5)*(d.shape==='circle'?.75:.95)/Math.max(2,[...d.text].length)))+'mm';add(node,field('div','s-text','text',d.text));}
 else if(b.type==='box'){Object.assign(node.style,{background:d.fill==='none'?'transparent':d.fill,borderColor:d.border==='none'?'transparent':d.border,borderWidth:(d.width??.4)+'mm',borderStyle:d.dash?'dashed':'solid',borderRadius:(d.radius||0)+'mm'});}
 else if(b.type==='shape'){node.style.setProperty('--c',d.color);if(d.stroke&&d.stroke!=='none')node.style.setProperty('--stroke',d.stroke);node.classList.add('shape-'+d.kind);node.innerHTML=SHAPE_SVG[d.kind]||drawn(d.kind,b.w,b.h);}
 else if(b.type==='qr'){const qr=qrSvg(d.url);add(node,qr||el('span',{text:'URLを入力'}),d.caption?el('span',{text:d.caption}):null);}
 else if(b.type==='image'){add(node,el('img',{src:d.src,alt:'',style:d.fit==='fill'?'object-fit:fill':''}));}
 add(node,el('span',{class:'handle','data-handle':'1'}));
 node.addEventListener('pointerdown',e=>startDrag(e,b,page,node));
 node.addEventListener('dblclick',e=>startEdit(e,b,node));
 return node;
}
// A QR code hidden under a sticker, illustration or stamp cannot be scanned.
// A QR code hidden under a sticker, illustration or stamp cannot be scanned. Sample what is really drawn on top.
function coveredQrs(){
 const hits=new Set();
 document.querySelectorAll('.sheet svg.qr-code').forEach(svg=>{
  const host=svg.closest('.blk'),r=svg.getBoundingClientRect();let covered=false;
  for(let i=1;i<6&&!covered;i++)for(let j=1;j<6&&!covered;j++){
   const top=document.elementsFromPoint(r.left+r.width*i/6,r.top+r.height*j/6).find(n=>n.classList?.contains('blk')&&!n.classList.contains('box')&&!n.classList.contains('shape'));
   if(top&&top!==host)covered=true;
  }
  host.classList.toggle('qr-covered',covered);if(covered)hits.add(host);
 });
 return hits.size;
}
function checkOverflow(){
 let over=0;
 document.querySelectorAll('.blk.program,.blk.text,.blk.heading').forEach(n=>{
  const inner=n.classList.contains('program')?n.querySelector('.p-main'):n;
  // A taped slip draws its tape outside the box on purpose; measure its text instead.
  const t=n.classList.contains('taped')||n.classList.contains('notched')?n.querySelector('.t-text'):null;
  let o=t?t.scrollHeight>n.clientHeight+2:(n.scrollHeight>n.clientHeight+2||(inner&&inner.scrollHeight>inner.clientHeight+2));
  // Flyer-style slots pin the amount and contact to the bottom; the text above must not run into them.
  const lower=n.querySelector(':scope>.p-lower');
  if(lower){const above=[...n.children].filter(c=>c!==lower&&!c.classList.contains('p-qr')&&!c.classList.contains('handle')&&!c.classList.contains('draft-badge')).pop();if(above&&above.getBoundingClientRect().bottom>lower.getBoundingClientRect().top+1)o=true;}
  n.classList.toggle('overflow',o);if(o)over++;
 });
 const covered=coveredQrs();
 if(over||covered)status([over?`文字が枠からあふれている枠が${over}件あります（赤い点線）。枠を広げるか文字を減らしてください。`:'',covered?`QRコードに他の部品が重なっている枠が${covered}件あります（オレンジの点線）。重なると読み取れないため、部品をずらしてください。`:''].filter(Boolean).join(' '),true);
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
function fieldAt(e,node){
 // Dragging captures the pointer on the slot, so the event target is the slot itself; look under the pointer instead.
 const direct=e.target.closest?.('[data-field]');if(direct&&node.contains(direct))return direct;
 for(const n of document.elementsFromPoint(e.clientX,e.clientY)){const f=n.closest?.('[data-field]');if(f&&node.contains(f))return f;}
 return null;
}
function startEdit(e,b,node){
 const f=fieldAt(e,node);if(!f)return;
 e.stopPropagation();editing=true;snapshot();
 const raw=b.data[f.dataset.field];if(typeof raw==='string')f.textContent=f.dataset.field==='tel'?'TEL：'+raw:raw;
 f.contentEditable='true';f.focus();
 const sel=getSelection();sel.selectAllChildren(f);sel.collapseToEnd();
 showFormatBar(f);
 f.addEventListener('paste',ev=>{ev.preventDefault();document.execCommand('insertText',false,ev.clipboardData.getData('text/plain'));});
 f.addEventListener('blur',()=>{
  let v=f.innerText.replace(/\n$/,'');
  if(f.dataset.field==='tel')v=v.replace(/^TEL[：:]\s*/,'');
  b.data[f.dataset.field]=v;f.contentEditable='false';editing=false;hideFormatBar();commit();
 },{once:true});
}

// ---------- formatting toolbar for the part of a line being edited ----------
const FORMAT=[['赤','赤','#e60012'],['橙','橙','#e2701e'],['青','青','#1f5fa8'],['緑','緑','#2a7a3f'],['黒','黒','#222'],['白','白','#888'],['特大','特大'],['大','大'],['小','小'],['極小','極小'],['太','太字']];
function showFormatBar(f){
 const bar=$('#fmt-bar');bar.hidden=false;
 const r=f.getBoundingClientRect();bar.style.left=Math.max(8,Math.min(innerWidth-bar.offsetWidth-8,r.left))+'px';bar.style.top=Math.max(60,r.top-bar.offsetHeight-8)+'px';
}
function hideFormatBar(){$('#fmt-bar').hidden=true;}
function wrapSelection(tag){
 const sel=getSelection(),f=document.activeElement;
 if(!f?.isContentEditable||!sel.rangeCount||sel.isCollapsed){status('色や大きさを変えたい文字を選んでから押してください。');return;}
 document.execCommand('insertText',false,`[${tag}]${sel.toString()}[/${tag}]`);
}
function clearMarks(){
 const sel=getSelection(),f=document.activeElement;if(!f?.isContentEditable)return;
 if(sel.isCollapsed)sel.selectAllChildren(f);
 document.execCommand('insertText',false,sel.toString().replace(/\[\/?(?:赤|橙|青|緑|白|黒|特大|大|小|極小|太|\d{2,3}%)\]/g,''));
}
{
 const bar=$('#fmt-bar');
 bar.append(...FORMAT.map(([tag,label,color])=>el('button',{type:'button',title:`選んだ文字を「${label}」にする`,style:color?`color:${color};font-weight:700`:'',onclick:()=>wrapSelection(tag)},label)),
  el('select',{'aria-label':'選んだ文字の大きさ',onchange:e=>{if(e.target.value)wrapSelection(e.target.value);e.target.value='';}},el('option',{value:''},'大きさ％'),...[50,70,80,90,110,120,140,160,200].map(v=>el('option',{value:v+'%'},v+'%'))),
  el('button',{type:'button',title:'選んだ範囲（選んでいなければ全体）の色・大きさを元に戻す',onclick:clearMarks},'書式を消す'));
 // Keep the text field focused while using the bar.
 bar.addEventListener('pointerdown',e=>{if(e.target.tagName!=='SELECT')e.preventDefault();});
}

// ---------- properties panel ----------
// Swatches plus a free colour picker. 'none' means the slot's normal colour.
function colorRow(label,current,onPick,{allowNone=false}={}){
 const pick=el('input',{type:'color',value:/^#[0-9a-f]{6}$/i.test(current||'')?current:'#222222','aria-label':label+'（自由に選ぶ）'});
 pick.addEventListener('change',()=>{snapshot();onPick(pick.value);commit();});
 return [el('label',{text:label}),el('div',{class:'swatches'},...COLORS.map(c=>el('button',{type:'button','aria-label':label+' '+c,'aria-pressed':String(c===current),style:`background:${c}`,onclick:()=>{snapshot();onPick(c);commit();}})),pick,
  allowNone?el('button',{type:'button',class:'reset','aria-pressed':String(!current||current==='none'),onclick:()=>{snapshot();onPick('none');commit();}},'標準'):null)];
}
function rangeRow(label,value,min,max,step,onChange,fmt=v=>v){
 const id=uid('f'),out=el('output',{for:id,text:fmt(value)}),r=el('input',{type:'range',id,min,max,step,value});
 r.addEventListener('pointerdown',()=>snapshot(),{once:true});
 r.addEventListener('input',()=>{onChange(Number(r.value));out.textContent=fmt(Number(r.value));persist();renderCanvasOnly();});
 return [el('label',{for:id},label+'　',out),r];
}
const pct=v=>Math.round(v*100)+'%';
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
  parts.push(el('label',{for:sizeId,text:'文字の大きさ（全体）'}),size,...colorRow('枠の色',d.color,c=>d.color=c),
   el('h3',{class:'sub',text:'項目ごとの文字'}),
   ...rangeRow('制度名の大きさ',d.titleSize??1,.6,1.8,.05,v=>d.titleSize=v,pct),...colorRow('制度名の色',d.titleColor,c=>d.titleColor=c,{allowNone:true}),
   ...rangeRow('キャッチの大きさ',d.catchSize??1,.6,1.8,.05,v=>d.catchSize=v,pct),...colorRow('キャッチの色',d.catchColor,c=>d.catchColor=c,{allowNone:true}),
   ...rangeRow('本文の大きさ',d.bodySize??1,.6,1.8,.05,v=>d.bodySize=v,pct),...colorRow('本文の色',d.bodyColor,c=>d.bodyColor=c,{allowNone:true}),
   ...rangeRow('本文の行間',d.bodyLine??1.38,1,2.2,.04,v=>d.bodyLine=v,v=>v.toFixed(2)),
   ...rangeRow('金額の大きさ',d.amountSize??1,.6,1.8,.05,v=>d.amountSize=v,pct),...colorRow('金額の色',d.amountColor,c=>d.amountColor=c),
   ...rangeRow('QRコードの大きさ（mm）',d.qrSize??17,10,30,.5,v=>d.qrSize=v),
   el('p',{class:'hint',text:'文字の一部だけ色や大きさを変えるときは、枠の文字をダブルクリックし、変えたい文字を選んで上に出るボタンを押します。'}));
  if(d.draft)parts.push(el('label',{},el('input',{type:'checkbox',checked:false,onchange:e=>{if(e.target.checked){snapshot();d.draft=false;commit();}}}),' 内容を確定した（下書き表示を消す）'));
  if(d.source)parts.push(el('div',{class:'source'},'元にした制度：'+d.source.title+(d.source.area?`（${d.source.area}）`:''),el('br'),d.source.url?el('a',{href:d.source.url,target:'_blank',rel:'noopener'},'公式情報を開く'):null));
 }else if(b.type==='heading'){parts.push(...input('文字',d.text,v=>d.text=v),...rangeRow('文字の大きさ（mm）',d.size??5.2,2,14,.1,v=>d.size=v,v=>v.toFixed(1)),...colorRow('色',d.color,c=>d.color=c));}
 else if(b.type==='text'){
  parts.push(...input('文字',d.text,v=>d.text=v,{multiline:true}),
   ...rangeRow('文字の大きさ（mm）',d.size,1.5,30,.1,v=>d.size=v,v=>v.toFixed(1)),
   ...rangeRow('行間',d.line??1.35,.9,2.6,.05,v=>d.line=v,v=>v.toFixed(2)),
   ...rangeRow('文字の間隔',d.spacing??0,0,1,.02,v=>d.spacing=v,v=>v.toFixed(2)+'字'),
   el('label',{},el('input',{type:'checkbox',checked:d.bold,onchange:e=>{snapshot();d.bold=e.target.checked;commit();}}),' 太字'),
   el('label',{text:'そろえ'}),el('div',{class:'swatches'},...[['left','左'],['center','中央'],['right','右']].map(([v,t])=>el('button',{type:'button','aria-pressed':String(d.align===v),style:'width:auto;border-radius:5px;padding:0 8px;background:#fff',onclick:()=>{snapshot();d.align=v;commit();}},t))),
   ...colorRow('文字の色',d.color,c=>d.color=c),
   el('label',{text:'書体'}),el('div',{class:'swatches'},...[['maru','丸ゴシック'],['gothic','ゴシック'],['hand','手書き風']].map(([v,t])=>el('button',{type:'button','aria-pressed':String((d.font||'maru')===v),style:'width:auto;border-radius:5px;padding:0 8px;background:#fff',onclick:()=>{snapshot();d.font=v;commit();}},t))),
   el('label',{text:'背景'}),swatches(d.bg,c=>d.bg=d.bg===c?'none':c),
   el('label',{},el('input',{type:'checkbox',checked:d.tape&&d.tape!=='none',onchange:e=>{snapshot();d.tape=e.target.checked?'#e2701e':'none';if(e.target.checked&&(!d.bg||d.bg==='none'))d.bg='#ffffff';commit();}}),' 吹き出し札（テープ付き）'));
 }else if(b.type==='stamp'){parts.push(...input('スタンプの文字',d.text,v=>d.text=v),el('label',{text:'色'}),swatches(d.color,c=>d.color=c),
  el('label',{},el('input',{type:'checkbox',checked:d.shape==='circle',onchange:e=>{snapshot();d.shape=e.target.checked?'circle':'rect';commit();}}),' 丸型'));}
 else if(b.type==='box'){parts.push(el('label',{text:'塗り'}),swatches(d.fill,c=>{d.fill=c;d.border=c;}),el('p',{class:'hint',text:'元のチラシの不要な部分を隠すときに使います。白以外の色も選べます。'}));
  parts.push(el('button',{type:'button',class:'btn',onclick:()=>{snapshot();d.fill='#ffffff';d.border='#ffffff';commit();}},'白に戻す'));}
 else if(b.type==='qr'){parts.push(...input('URL',d.url,v=>d.url=v,{type:'url'}),...input('下の文字',d.caption,v=>d.caption=v));}
 else if(b.type==='image'){parts.push(el('button',{type:'button',class:'btn',onclick:async()=>{status('透過処理中…');try{const src=await clearWhite(d.src);snapshot();d.src=src;commit();status('周りの白い背景を透明にしました（図形の内側の白は残します）。元に戻すで取り消せます。');}catch{status('この画像は透過処理できませんでした',true);}}},'周りの白い背景を透明にする'),
  el('label',{},el('input',{type:'checkbox',checked:d.fit==='fill',onchange:e=>{snapshot();d.fit=e.target.checked?'fill':'contain';commit();}}),' 枠いっぱいに引き伸ばす'));}
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
   el('button',{type:'button',onclick:()=>{startPlacement(programBlock(r,{x:12,y:40},undefined,programLook(doc)),r.outside_reason?'高知市版の下書きとして':'');}},'チラシに追加'),
   b?.type==='program'?el('button',{type:'button',class:'swap',onclick:()=>{snapshot();const page=pageOf(selected.page);const i=page.blocks.findIndex(x=>x.id===b.id);page.blocks[i]=replaceContent(b,r);commit();status('選んだ枠の中身を入れ替えました');}},'この枠と入れ替え'):null,
   r.url?el('a',{href:r.url,target:'_blank',rel:'noopener',style:'font-size:11.5px;color:#a32126;align-self:center'},'公式情報'):null))));
}

// ---------- import / export ----------
// Make the white background around a logo transparent while keeping white lines inside it (e.g. the city emblem).
// The figure is first thickened so thin gaps cannot leak, the outside is flood-filled, then grown back over light pixels.
async function clearWhite(src){
 const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=src;});
 const k=Math.min(4,2400/Math.max(img.naturalWidth,img.naturalHeight)),c=document.createElement('canvas');
 c.width=Math.max(1,Math.round(img.naturalWidth*k));c.height=Math.max(1,Math.round(img.naturalHeight*k));
 const g=c.getContext('2d');g.imageSmoothingQuality='high';g.drawImage(img,0,0,c.width,c.height);
 const data=g.getImageData(0,0,c.width,c.height),px=data.data,w=c.width,h=c.height,N=w*h;
 const light=new Uint8Array(N);for(let i=0;i<N;i++){const r=px[i*4],gg=px[i*4+1],b=px[i*4+2];light[i]=px[i*4+3]<16||(Math.min(r,gg,b)>=200&&Math.max(r,gg,b)-Math.min(r,gg,b)<=40)?1:0;}
 const dilate=(src,R)=>{const a=new Uint8Array(N),out=new Uint8Array(N);
  for(let y=0;y<h;y++){let run=-1e9;for(let x=0;x<w;x++){if(src[y*w+x])run=x;a[y*w+x]=x-run<=R?1:0;}run=1e9;for(let x=w-1;x>=0;x--){if(src[y*w+x])run=x;if(run-x<=R)a[y*w+x]=1;}}
  for(let x=0;x<w;x++){let run=-1e9;for(let y=0;y<h;y++){if(a[y*w+x])run=y;out[y*w+x]=y-run<=R?1:0;}run=1e9;for(let y=h-1;y>=0;y--){if(a[y*w+x])run=y;if(run-y<=R)out[y*w+x]=1;}}
  return out;};
 const R=Math.max(2,Math.round(Math.min(w,h)*.012)),ink=new Uint8Array(N);for(let i=0;i<N;i++)ink[i]=light[i]?0:1;
 const wall=dilate(ink,R),outside=new Uint8Array(N),stack=[];
 for(let x=0;x<w;x++)stack.push(x,(h-1)*w+x);for(let y=0;y<h;y++)stack.push(y*w,y*w+w-1);
 while(stack.length){const i=stack.pop();if(outside[i]||wall[i])continue;outside[i]=1;const x=i%w,y=(i-x)/w;if(x>0)stack.push(i-1);if(x<w-1)stack.push(i+1);if(y>0)stack.push(i-w);if(y<h-1)stack.push(i+w);}
 const near=dilate(outside,R+1);
 for(let i=0;i<N;i++)if(near[i]&&light[i])px[i*4+3]=0;
 g.putImageData(data,0,0);return c.toDataURL('image/png');
}
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
 if(btn.dataset.part==='program')return startPlacement(emptyProgram({x:12,y:40},programLook(doc)));
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
// Most office printers cannot print to the paper edge; shrink the sheet into the printable area unless turned off.
const PRINT_PREF='kochi-flyer-print';
function printPrefs(){try{return JSON.parse(localStorage.getItem(PRINT_PREF))||{fit:true,margin:5};}catch{return {fit:true,margin:5};}}
$('#print').addEventListener('click',()=>{const pr=printPrefs();$('#print-fit').checked=pr.fit!==false;$('#print-margin').value=String(pr.margin||5);$('#print-dialog').showModal();});
$('#print-cancel').addEventListener('click',()=>$('#print-dialog').close());
$('#print-go').addEventListener('click',async()=>{
 const fit=$('#print-fit').checked,margin=Number($('#print-margin').value)||5;
 try{localStorage.setItem(PRINT_PREF,JSON.stringify({fit,margin}));}catch{}
 $('#print-dialog').close();selected=null;render();await document.fonts.ready;
 const {w,h}=paper(),k=fit?Math.min((w-2*margin)/w,(h-2*margin)/h):1;
 document.body.classList.toggle('print-fit',fit);
 document.body.style.setProperty('--ps',k);document.body.style.setProperty('--px',((w-w*k)/2)+'mm');document.body.style.setProperty('--py',((h-h*k)/2)+'mm');
 document.body.style.setProperty('--ph',h+'mm');
 status(fit?`周り${margin}mmの余白を残して印刷します。印刷画面で用紙A3・余白なし・倍率100%・背景のグラフィックをオンにしてください。`:'用紙いっぱいに印刷します。印刷画面で用紙A3・余白なし・倍率100%・背景のグラフィックをオンにしてください。');
 setTimeout(()=>window.print(),300);
});
$('#doc-title').addEventListener('input',e=>{doc.title=e.target.value;persist();});
$('#zoom').addEventListener('change',render);
addEventListener('resize',()=>{if($('#zoom').value==='fit')render();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&pending){cancelPlacement();return;}},true);
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
 const q=qrcode(0,'L');q.addData(url,'Byte');q.make();
 const n=q.getModuleCount(),cell=12,margin=4,c=document.createElement('canvas');c.width=c.height=(n+margin*2)*cell;
 const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.fillStyle='#000';
 for(let r=0;r<n;r++)for(let k=0;k<n;k++)if(q.isDark(r,k))g.fillRect((k+margin)*cell,(r+margin)*cell,cell,cell);
 const a=el('a',{href:c.toDataURL('image/png'),download:'qrcode.png'});document.body.append(a);a.click();a.remove();
 $('#qr-message').textContent='PNG画像を保存しました（印刷向けの高解像度）。';
});

render();
loadRecords().catch(()=>{$('#search-hint').textContent='制度データを読み込めませんでした。';});
