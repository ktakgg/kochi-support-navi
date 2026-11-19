export const normalize=s=>String(s??'').normalize('NFKC').toLowerCase().replace(/[\s　・、。ー\-]/g,'');
export function statusOf(r,now=new Date()){
 if(r.closed===true||/受付(?:は)?終了|募集(?:は)?終了/.test(normalize(r.title)))return '受付終了';
 if(!['reviewed','structured'].includes(r.review_state))return '要確認';
 if(r.rounds?.length){
  const states=r.rounds.map(x=>{
   if(x.closed)return '受付終了';
   if(x.end&&now>new Date(x.end))return '受付終了';
   if(x.start&&now<new Date(x.start))return '受付前';
   return x.confirmed_open?'受付中（確認時点）':'要確認';
  });
  for(const s of ['受付中（確認時点）','要確認','受付前'])if(states.includes(s))return s;
  return '受付終了';
 }
 return r.continuous?'随時受付（確認時点）':'要確認';
}
const synonyms=[['産業団地','工業団地','企業団地','企業立地','立地促進','立地助成','企業誘致'],['リフォーム','住宅改修','改修'],['ソーラー','太陽光'],['子供','子ども'],['蓄電池','蓄電'],['開業','創業'],['取り壊し','解体','除却']];
export function queryMatches(r,q){
 const text=normalize([r.title,r.summary,r.eligibility,r.amount,...r.purposes,...r.audiences,r.source_name,r.source_level,r.issuer_name,r.target_area,...(r.keywords||[]),...(r.html_extraction&&r.html_extraction.source_hash===r.hash?(r.html_extraction.sections||[]).map(x=>x.heading+' '+x.text):[])].join(' '));
 return q.trim().split(/[\s　]+/).filter(Boolean).every(term=>{
  let alternatives=[term];for(const group of synonyms)if(group.some(x=>normalize(x)===normalize(term)))alternatives=group;
  return alternatives.some(x=>text.includes(normalize(x)));
 });
}
export function facetValues(r,key){return key==='levels'?[r.source_level]:key==='sources'?[r.source_name]:(r[key]||[]);}
export function filterRecords(records,state,now=new Date()){
 return records.filter(r=>queryMatches(r,state.q||'')&&['audiences','purposes','levels','sources'].every(k=>!state[k]?.length||state[k].some(v=>facetValues(r,k).includes(v)))&&(!state.status?.length||state.status.includes(statusOf(r,now))));
}
export function dateLabel(s){if(!s)return '未確認';return new Date(s).toLocaleDateString('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'});}

function excerpt(text,limit){
 const full=Array.from(String(text||'').replace(/\s+/gu,' ').trim());
 return {text:full.length>limit?full.slice(0,limit).join('')+'…':full.join(''),partial:full.length>limit};
}
// Page furniture copied from CMS bodies; never a description of the program.
const NOISE=/^(?:公開日|更新日|最終更新|掲載日|ページ番号)|はこちら[！!。]?$|\[\[|ページの評価|[［\[](?:PDF|ＰＤＦ)|^(?:PDF|印刷|ダウンロード)/;
const meaningful=text=>String(text||'').split('\n').map(x=>x.trim().replace(/^[■□◆◇●○◯・※]+\s*/,'')).filter(x=>x&&!NOISE.test(x));
function firstSentence(text){
 // A label such as 「誘致支援」 is a link caption, not an overview.
 const line=meaningful(text).find(x=>Array.from(x).length>=12)||'';
 return line.replace(/^(.{20,}?。).*$/u,'$1');
}
function keyAmount(text){
 // Tables of 「区分 ｜ 金額」: list the amounts only and send the reader to the detail page for the pairing.
 const values=[...new Set(meaningful(text).filter(x=>x.includes(' ｜ ')).map(x=>x.split(' ｜ ').pop().trim()).filter(x=>Array.from(x).length<=16&&/[0-9０-９].*(?:円|%|％)|分の/.test(x)))];
 if(values.length>=2)return {text:values.join('・')+'（区分により異なる）',omitted:true};
 const lines=meaningful(text).map(x=>x.replace(/\s*｜\s*/g,'：').replace(/^[・●○◯■□※]\s*/,''));
 const hits=lines.filter(x=>/[0-9０-９].*(?:円|%|％)|[0-9０-９]+\s*分の\s*[0-9０-９]+|[0-9０-９]+\s*[\/／]\s*[0-9０-９]+|補助率|上限/.test(x));
 const picked=(hits.length?hits:lines).slice(0,2);
 return {text:picked.join('／'),omitted:picked.length<lines.length};
}
function keyEligibility(text){
 // Lead-in sentences such as 「次の要件をすべて満たす方」 say nothing on their own.
 const lines=meaningful(text).map(x=>x.replace(/^[・●○◯■□※]\s*|^[（(]?[0-9０-９]+[)）.．]\s*|^[⑴-⑽①-⑳ア-オ][\s.．、]\s*/,''));
 const useful=lines.filter(x=>!/(?:次|以下)の.{0,12}(?:いずれか|要件|各号|全て|すべて)|次に掲げる/.test(x));
 const picked=(useful.length?useful:lines).slice(0,2);
 return {text:picked.join('／'),omitted:picked.length<lines.length};
}
function deadline(r,now){
 const ends=(r.rounds||[]).filter(x=>x.end&&!x.closed&&new Date(x.end)>=now).map(x=>new Date(x.end)).sort((a,b)=>a-b);
 return ends.length?ends[0].toLocaleDateString('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'numeric',day:'numeric'})+'まで':'';
}
export function cardDetails(r,now=new Date()){
 const extraction=r.html_extraction;
 const sections=extraction&&extraction.source_hash===r.hash&&r.review_state!=='reviewed'?extraction.sections||[]:[];
 const overview=firstSentence(sections.find(s=>s.kind==='overview')?.text);
 const own=r.summary==='制度の詳細条件は掲載元の公式ページをご確認ください。'?'':firstSentence(r.summary);
 const summary=excerpt(own||overview,50);
 const amountSections=sections.filter(s=>s.kind==='amount').sort((a,b)=>Number(/上限|金額|補助額|助成額|給付額|支給額/.test(b.heading||''))-Number(/上限|金額|補助額|助成額|給付額|支給額/.test(a.heading||'')));
 const amountText=amountSections.map(s=>s.text).join('\n')||r.amount||'';
 const eligibilityText=sections.filter(s=>s.kind==='eligibility').map(s=>s.text).join('\n')||r.eligibility||'';
 const amountKey=keyAmount(amountText),eligibilityKey=keyEligibility(eligibilityText);
 const support=excerpt(amountKey.text,40);support.partial ||= amountKey.omitted;
 const eligibility=excerpt(eligibilityKey.text,40);eligibility.partial ||= eligibilityKey.omitted;
 return {title:excerpt(r.title,48),summary,support,eligibility,deadline:deadline(r,now),area:excerpt(r.target_area,24).text};
}
