import test from 'node:test';import assert from 'node:assert/strict';import{statusOf,filterRecords,queryMatches}from'../dist/core.mjs';
const record={title:'住宅改修補助金',summary:'高知市の住まいの支援',audiences:['個人・世帯'],purposes:['住まい'],review_state:'reviewed',rounds:[{start:'2026-10-01T00:00:00+09:00',end:'2026-10-29T16:30:00+09:00',confirmed_open:true}]};
test('期限の時刻直後に検索・表示・件数の判定が切り替わる',()=>{const before=new Date('2026-10-29T07:30:00Z'),after=new Date('2026-10-29T07:30:01Z');assert.equal(statusOf(record,before),'受付中（確認時点）');assert.equal(statusOf(record,after),'受付終了');assert.equal(filterRecords([record],{status:['受付中（確認時点）']},after).length,0);});
test('未確認候補を日付だけで受付中にしない',()=>assert.equal(statusOf({...record,review_state:'pending'},new Date('2026-10-20')),'要確認'));
test('予算終了の明示を日付より優先',()=>assert.equal(statusOf({...record,closed:true},new Date('2026-10-20')),'受付終了'));
test('追加募集があれば最初の募集終了で制度全体を閉じない',()=>assert.equal(statusOf({...record,rounds:[{end:'2025-01-01T00:00:00+09:00'},...record.rounds]},new Date('2026-10-20')),'受付中（確認時点）'));
test('属性内OR・分類間AND',()=>{assert.equal(filterRecords([record],{audiences:['事業者','個人・世帯'],purposes:['住まい']}).length,1);assert.equal(filterRecords([record],{audiences:['事業者'],purposes:['住まい']}).length,0);});
test('言い換え・全角正規化・複数語AND',()=>{assert.ok(queryMatches(record,'リフォーム 高知'));assert.ok(!queryMatches(record,'リフォーム 太陽光'));});

test('国・県・市・支援機関と団体の条件をANDで組み合わせる',()=>{
 const a={...record,source_level:'県',source_name:'高知県'},b={...record,source_level:'支援機関',source_name:'高知県産業振興センター'};
 assert.equal(filterRecords([a,b],{levels:['県'],sources:['高知県産業振興センター']}).length,0);
 assert.equal(filterRecords([a,b],{levels:['県','支援機関'],sources:['高知県産業振興センター']}).length,1);
 assert.ok(queryMatches(b,'産業振興センター'));
});

test('API期間は構造化データとして判定し、RSS概要は受付中と推測しない',()=>{
 const r={title:'補助金',review_state:'structured',rounds:[{start:'2026-10-01T00:00:00Z',end:'2026-11-01T08:30:00Z',confirmed_open:true}]};
 assert.equal(statusOf(r,new Date('2026-10-29T00:00Z')),'受付中（確認時点）');
 assert.equal(statusOf({...r,review_state:'pending'},new Date('2026-10-29T00:00Z')),'要確認');
 assert.equal(statusOf(r,new Date('2026-11-01T08:30:01Z')),'受付終了');
});
