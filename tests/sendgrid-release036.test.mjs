import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifySendgridDomain,verifySendgridSandbox} from '../lib/email/sendgrid.ts';
const key='SG.abcdefghijklmnopqrstuvwxyz.abcdefghijklmnopqrstuvwxyz';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
test('Only exact, validated sender domain is accepted',async()=>{
 let calls=0;
 const transport=async(url)=>{calls++;assert.match(url,/^https:\/\/api\.sendgrid\.com\/v3\/whitelabel\/domains/);return json([{domain:'charismfb.com.evil.org',valid:true},{domain:'charismfb.com',valid:false}]);};
 await assert.rejects(verifySendgridDomain({apiKey:key,from:'contact@charismfb.com',transport}),/not authenticated/);
 assert.equal(calls,1);
});
test('Authenticated domain is verified and sandbox request does not send live email',async()=>{
 const transport=async(url,init)=>{
  if(url.includes('whitelabel'))return json([{domain:'charismfb.com',valid:true}]);
  assert.equal(url,'https://api.sendgrid.com/v3/mail/send');
  const body=JSON.parse(init.body);
  assert.equal(body.mail_settings.sandbox_mode.enable,true);
  assert.deepEqual(body.personalizations,[{to:[{email:'staff@charismfb.com'}]}]);
  return new Response(null,{status:202});
 };
 const result=await verifySendgridSandbox({apiKey:key,from:'contact@charismfb.com',to:'staff@charismfb.com',transport});
 assert.deepEqual(result,{verified:true,sandbox:true});
});
test('Bad key and sender domain reject before provider contact',async()=>{
 const transport=async()=>{throw Error('Should never be called');};
 await assert.rejects(verifySendgridDomain({apiKey:'bad',from:'contact@charismfb.com',transport}),/valid SendGrid API key/);
 await assert.rejects(verifySendgridDomain({apiKey:key,from:'contact@evil.com/',transport}),/valid email address/);
});
test('SendGrid integration remains separated from live delivery, approval and customer lists',()=>{
 const a=readFileSync(new URL('../app/admin/sendgrid/actions.ts',import.meta.url),'utf8');
 const b=readFileSync(new URL('../lib/email/sendgrid.ts',import.meta.url),'utf8');
 assert.match(a,/can_manage_senders/);
 assert.match(a,/SENDGRID_STAFF_TEST_EMAIL/);
 assert.doesNotMatch(a,/EMAIL_DELIVERY_ENABLED\s*=/);
 assert.match(b,/sandbox_mode:\s*\{enable:true\}/);
 assert.doesNotMatch(b,/marketing\/contacts|singlesends\/.*schedule|\/api\/worker/);
});
