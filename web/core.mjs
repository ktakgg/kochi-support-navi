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
const synonyms=[['リフォーム','住宅改修','改修'],['ソーラー','太陽光'],['子供','子ども'],['蓄電池','蓄電'],['開業','創業'],['取り壊し','解体','除却']];
export function queryMatches(r,q){
 const text=normalize([r.title,r.summary,r.eligibility,r.amount,...r.purposes,...r.audiences,r.source_name,r.source_level,r.issuer_name,r.target_area,...(r.keywords||[])].join(' '));
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
