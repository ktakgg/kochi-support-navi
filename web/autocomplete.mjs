import {normalize,queryMatches} from './core.mjs';
export function suggestionsFor(records,query){
 const q=normalize(query);if(!q)return [];
 const words=[...new Set(records.flatMap(r=>[...(r.purposes||[]),...(r.keywords||[]),r.source_name]).filter(x=>x&&x.length<=35))];
 const keywords=words.filter(w=>normalize(w).includes(q)&&normalize(w)!==q).sort((a,b)=>Number(normalize(b).startsWith(q))-Number(normalize(a).startsWith(q))||a.length-b.length).slice(0,2).map(value=>({value,kind:'キーワード'}));
 const titles=[...new Set(records.filter(r=>queryMatches(r,query)).map(r=>r.title))].sort((a,b)=>Number(normalize(b).startsWith(q))-Number(normalize(a).startsWith(q))||a.length-b.length).slice(0,6-keywords.length).map(value=>({value,kind:'制度名'}));
 return [...keywords,...titles];
}
export function setupAutocomplete(records){
 const input=document.getElementById('query'),form=input.form;
 const panel=document.createElement('div');panel.className='autocomplete-panel';panel.hidden=true;
 const hint=document.createElement('p');hint.className='autocomplete-hint';hint.textContent='入力候補　↑↓で選択・Enterで検索';
 const list=document.createElement('div');list.id='query-options';list.role='listbox';list.setAttribute('aria-label','検索候補');
 const announcer=document.createElement('span');announcer.className='sr-only';announcer.setAttribute('aria-live','polite');
 panel.append(hint,list);form.append(panel,announcer);
 input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-controls',list.id);input.setAttribute('aria-expanded','false');
 let active=-1,options=[],composing=false;
 function close(){panel.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');active=-1;}
 function select(index){active=index;[...list.children].forEach((el,i)=>el.setAttribute('aria-selected',String(i===index)));if(index>=0){input.setAttribute('aria-activedescendant','query-option-'+index);list.children[index].scrollIntoView({block:'nearest'});}else input.removeAttribute('aria-activedescendant');}
 function choose(index){if(!options[index])return;input.value=options[index].value;close();form.requestSubmit();}
 function refresh(){
  if(composing)return;options=suggestionsFor(records,input.value);active=-1;input.removeAttribute('aria-activedescendant');list.replaceChildren();
  if(!options.length){close();announcer.textContent='';return;}
  options.forEach((option,i)=>{const el=document.createElement('div');el.id='query-option-'+i;el.role='option';el.setAttribute('aria-selected','false');el.className='autocomplete-option';const kind=document.createElement('span'),label=document.createElement('span');kind.className='autocomplete-kind';kind.textContent=option.kind;label.textContent=option.value;el.append(kind,label);el.addEventListener('pointerdown',e=>e.preventDefault());el.addEventListener('click',()=>choose(i));list.append(el);});
  panel.hidden=false;input.setAttribute('aria-expanded','true');announcer.textContent=options.length+'件の検索候補があります。';
 }
 input.addEventListener('input',refresh);input.addEventListener('focus',refresh);
 input.addEventListener('compositionstart',()=>{composing=true;close();});input.addEventListener('compositionend',()=>{composing=false;refresh();});
 input.addEventListener('keydown',event=>{
  if(composing||event.isComposing||event.keyCode===229)return;
  if(event.key==='Escape'){close();return;}
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){
   if(panel.hidden)refresh();if(panel.hidden)return;event.preventDefault();select((active+(event.key==='ArrowDown'?1:active<0?0:-1)+options.length)%options.length);
  }else if(event.key==='Enter'&&!panel.hidden&&active>=0){event.preventDefault();choose(active);}
 });
 input.addEventListener('blur',close);
 form.addEventListener('submit',event=>{if(composing){event.preventDefault();event.stopImmediatePropagation();}else close();},true);
 document.addEventListener('pointerdown',event=>{if(!form.contains(event.target))close();});
}
