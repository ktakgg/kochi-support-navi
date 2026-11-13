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
 const r={hash:'a',html_extraction:{source_hash:'a',sections:[{kind:'amount',text:'種類 ｜ 金額\n認証A ｜ 10万円\n※追加条件があります。'}]},eligibility:'あ'.repeat(300)};
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

test('対象経費の説明が長くても上限額と加算条件をカードに残す',()=>{
 const r={hash:'a',html_extraction:{source_hash:'a',sections:[
  {heading:'補助対象経費',kind:'amount',text:'住宅賃借費用。'.repeat(100)},
  {heading:'補助上限額',kind:'amount',text:'1世帯あたり30万円。ただし、親世帯と同居または近居の場合は45万円。'}]}};
 const card=cardDetails(r);
 assert.ok(card.support.text.startsWith('1世帯あたり30万円。'));
 assert.match(card.support.text,/同居または近居の場合は45万円/);
 assert.equal(card.support.partial,true);
});

test('結婚新生活支援のカードに上限額・加算条件・年齢・所得条件を表示する',()=>{
 const records=JSON.parse(readFileSync(new URL('../dist/data.json',import.meta.url))).records;
 const r=records.find(r=>r.id==='c4599b1192ac691d'),card=cardDetails(r);
 for(const word of ['30万円','同居または近居','45万円'])assert.ok(card.support.text.includes(word));
 for(const word of ['39歳以下','500万円未満'])assert.ok(card.eligibility.text.includes(word));
 assert.deepEqual(r.audiences,['個人・世帯']);
 assert.ok(r.purposes.includes('住まい'));
 assert.equal(card.eligibility.partial,true);
 assert.equal(statusOf(r),'要確認');
});
