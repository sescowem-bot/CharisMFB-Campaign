import test from 'node:test';
import assert from 'node:assert/strict';
import {sendQueuedEmail} from '../lib/delivery/transport.ts';

const base={key:'test-key',id:'delivery-1',name:'Bank',from:'notice@mail.example.com',replyTo:'replies@mail.example.com',domain:'mail.example.com',to:'customer@example.com',cc:['copy@example.com'],bcc:['archive@example.com'],subject:'Service update',html:'<p>Update</p>'};

test('SendByte campaign payload carries CC and BCC without exposing BCC in CC',async()=>{
 let body;
 const result=await sendQueuedEmail({...base,provider:'sendbyte'},async(_url,options)=>{body=JSON.parse(options.body);return Response.json({data:{id:'sb-message'}});});
 assert.equal(result.status,'accepted');assert.deepEqual(body.cc,base.cc);assert.deepEqual(body.bcc,base.bcc);assert.deepEqual(body.to,[base.to]);
});
test('Resend campaign payload carries CC and BCC arrays',async()=>{
 let body;
 const result=await sendQueuedEmail({...base,provider:'resend'},async(_url,options)=>{body=JSON.parse(options.body);return Response.json({id:'re-message'});});
 assert.equal(result.status,'accepted');assert.deepEqual(body.cc,base.cc);assert.deepEqual(body.bcc,base.bcc);
});
test('Brevo campaign payload maps CC and BCC to recipient objects',async()=>{
 let body;
 const result=await sendQueuedEmail({...base,provider:'brevo'},async(_url,options)=>{body=JSON.parse(options.body);return Response.json({messageId:'br-message'});});
 assert.equal(result.status,'accepted');assert.deepEqual(body.cc,[{email:base.cc[0]}]);assert.deepEqual(body.bcc,[{email:base.bcc[0]}]);
});
test('invalid copy recipients are rejected before the provider is called',async()=>{
 let called=false;
 await assert.rejects(sendQueuedEmail({...base,provider:'sendbyte',cc:['not-an-email']},async()=>{called=true;return Response.json({data:{id:'x'}});}),/valid email/);
 assert.equal(called,false);
});
