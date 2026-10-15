import test from 'node:test';
import assert from 'node:assert/strict';
import {broadcastClient,ResendRequestError} from '../lib/email/resend-broadcasts.ts';
const segment='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const broadcast='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const email='customer@example.com';
function mockFetch(statusByPath=new Map()){
 const calls=[];
 const fetcher=async(url,options)=>{
  const path=new URL(url).pathname;
  calls.push({path,method:options.method,body:options.body?JSON.parse(options.body):null});
  const response=statusByPath.get(`${options.method} ${path}`) || {status:200,body:path==='/segments'?{id:segment}:path==='/broadcasts'?{id:broadcast}:path.includes('/send')?{id:broadcast}:path.includes('/contacts/')?{id:segment,unsubscribed:false}:{id:segment}};
  return new Response(JSON.stringify(response.body),{status:response.status,headers:{'Content-Type':'application/json'}});
 };
 return {calls,fetcher};
}
test('Resend marketing uses segments and Broadcasts, never the transactional /emails API',async()=>{
 const m=mockFetch(new Map([[`GET /contacts/${encodeURIComponent(email)}`,{status:404,body:{message:'Not Found'}}]]));
 const api=broadcastClient('re_testing_key_1234567890',m.fetcher);
 const segmentId=await api.segment('Charis approved audience');
 assert.equal(segmentId,segment);
 assert.equal(await api.addEligibleContact(email,'Ada','Okafor',segmentId),true);
 const id=await api.draft({segmentId,from:'news@charismfb.com',name:'Charis Microfinance Bank',subject:'Savings update',html:'<a href="{{{RESEND_UNSUBSCRIBE_URL}}}">Unsubscribe</a>'});
 assert.equal(id,broadcast);
 await api.send(id);
 assert.ok(m.calls.some(c=>c.path==='/broadcasts'&&c.body.send===false));
 assert.ok(m.calls.some(c=>c.path===`/broadcasts/${broadcast}/send`));
 assert.ok(m.calls.every(c=>!c.path.includes('/emails')));
});
test('Existing unsubscribed Resend contacts are skipped, never opted back in',async()=>{
 const m=mockFetch(new Map([[`GET /contacts/${encodeURIComponent(email)}`,{status:200,body:{unsubscribed:true,id:segment}}]]));
 const api=broadcastClient('re_testing_key_1234567890',m.fetcher);
 assert.equal(await api.addEligibleContact(email,'','',segment),false);
 assert.equal(m.calls.length,1);
});
test('No broadcast is allowed without an unsubscribe placeholder',async()=>{
 const m=mockFetch(),api=broadcastClient('re_testing_key_1234567890',m.fetcher);
 await assert.rejects(api.draft({segmentId:segment,from:'news@charismfb.com',name:'Charis',subject:'Updates',html:'<p>Hello</p>'}),/unsubscribe/);
 assert.equal(m.calls.length,0);
});
test('Ambiguous provider outages are flagged, not treated as confirmed sends',async()=>{
 const api=broadcastClient('re_testing_key_1234567890',async()=>{throw Error('timeout');});
 await assert.rejects(api.send(broadcast),(err)=>err instanceof ResendRequestError&&err.uncertain===true);
});
test('Charis integration routes marketing through separate Resend Broadcasts, not the old worker',async()=>{
 const fs=await import('node:fs');
 const source=fs.readFileSync('app/admin/providers/route-actions.ts','utf8');
 const worker=fs.readFileSync('lib/delivery/worker.ts','utf8');
 assert.match(source,/provider==='brevo'/);
 assert.match(worker,/Resend promotional traffic must use its Broadcast API/);
});
