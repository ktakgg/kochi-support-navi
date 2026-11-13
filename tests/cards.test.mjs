import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cardDetails,filterRecords,statusOf} from '../dist/core.mjs';

test('はたいくのカードは公式本文と同じ認証条件・金額・事業者を使う',()=>{
 const records=JSON.parse(readFileSync(new URL('../dist/data.json',import.meta.url))).records;
 const r=records.find(r=>r.id==='6a16f5f36647c945'),card=cardDetails(r);
 assert.match(card.summary.text,/男性従業員の育児休業/);
 assert.match(card.support.text,/男性育休推進部門の認証 ｜ 10万円/);
 assert.match(card.support.text,/いずれかの認定 ｜ 30万円/);
 assert.match(card.eligibility.text,/常時雇用する労働者/);
 assert.deepEqual(r.audiences,['事業者']);
 assert.equal(filterRecords([r],{audiences:['子育て世帯']}).length,0);
 assert.equal(filterRecords([r],{audiences:['事業者'],purposes:['創業・事業支援']}).length,1);
 assert.equal(card.area,'');
 assert.equal(statusOf(r),'要確認');
 assert.doesNotMatch(card.summary.text,/制度の詳細条件は/);
});

test('金額専用項目が空でも取得済みの支援内容と対象条件を使う',()=>{
 const r={hash:'a',summary:'制度の詳細条件は掲載元の公式ページをご確認ください。',html_extraction:{source_hash:'a',sections:[
  {kind:'overview',text:'市内事業者の設備導入を支援します。'},
  {kind:'amount',text:'専門家を派遣します。'},
  {kind:'eligibility',text:'市内の事業者'}]}};
 const card=cardDetails(r);
 assert.equal(card.summary.text,'市内事業者の設備導入を支援します。');
 assert.equal(card.support.text,'専門家を派遣します。');
 assert.equal(card.eligibility.text,'市内の事業者');
});

test('表の抜粋は明示し、長文の省略と過去の出典を区別する',()=>{
 const r={hash:'a',html_extraction:{source_hash:'a',sections:[{kind:'amount',text:'種類 ｜ 金額\n認証A ｜ 10万円\n※追加条件があります。'}]},eligibility:'あ'.repeat(200)};
 const card=cardDetails(r);
 assert.equal(card.support.text,'認証A ｜ 10万円');
 assert.equal(card.support.partial,true);
 assert.equal(card.eligibility.partial,true);
 assert.equal(cardDetails({...r,hash:'new',eligibility:null}).support.text,'');
});

test('人による確認済みの値を自動抽出で上書きしない',()=>{
 const r={review_state:'reviewed',hash:'a',amount:'確認した内容',html_extraction:{source_hash:'a',sections:[{kind:'amount',text:'別の内容'}]}};
 assert.equal(cardDetails(r).support.text,'確認した内容');
});
