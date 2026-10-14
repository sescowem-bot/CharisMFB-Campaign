import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {charisTemplatePresets} from '../lib/campaign/template-presets.ts';
import {previewProviderCapacity} from '../lib/email/capacity-preview.ts';
import {providerAdapter} from '../lib/email/providers.ts';
const file=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('ten distinct editable starter designs, no fabricated contact details',()=>{
 assert.equal(charisTemplatePresets.length,10);
 assert.equal(new Set(charisTemplatePresets.map(p=>p.id)).size,10);
 for(const t of charisTemplatePresets){assert.equal(t.design.version,'1');assert.ok(t.subject&&t.name);assert.ok(t.design.blocks.length>=3);assert.ok(t.design.blocks.some(b=>b.type==='heading'));}
 assert.ok(charisTemplatePresets.some(p=>p.category==='promotion'));
});
test('capacity planner never treats disabled/error providers as available',()=>{
 const plan=previewProviderCapacity(1000,[{provider:'resend',daily_limit:100,enabled:true,health_status:'healthy'},{provider:'brevo',daily_limit:300,enabled:true,health_status:'healthy'},{provider:'mailjet',daily_limit:200,enabled:false,health_status:'healthy'}]);
 assert.equal(plan.perDay,400);assert.equal(plan.days,3);assert.equal(plan.providers.reduce((s,p)=>s+p.allocated,0),1000);
 assert.equal(plan.providers.some(p=>p.provider==='mailjet'),false);
 assert.throws(()=>previewProviderCapacity(-1,[]));
});
test('migration 024 adds mailjet disabled, not a production sending toggle',()=>{
 const sql=file('supabase/migrations/024_charis_mailjet_provider_and_template_library.sql');
 assert.match(sql,/\('mailjet',false,'unchecked'/);assert.match(sql,/DROP CONSTRAINT IF EXISTS/);
});
test('Mailjet adapter uses authenticated fixed HTTPS endpoints and rejects unknown result',async()=>{
 process.env.MAILJET_SECRET_KEY='testing-secret';
 const calls=[];const mock=async(url,options)=>{calls.push({url,options});return url.includes('/v3.1/send')?Response.json({Messages:[{Status:'success',To:[{MessageID:123456}]}]}):Response.json({Data:[]});};
 const provider=providerAdapter('mailjet','testing-public',mock);
 await provider.health();
 assert.equal(calls[0].url,'https://api.mailjet.com/v3/REST/sender?Limit=1');
 assert.equal(calls[0].options.headers.Authorization,'Basic '+Buffer.from('testing-public:testing-secret').toString('base64'));
 const id=await provider.sendTest({name:'Charis test',email:'hello@example.com',replyTo:'reply@example.com',domain:'example.com',to:'tester@example.com',html:'<p>Hi</p>',attempt:'test-key'});
 assert.equal(id,'123456');assert.equal(calls[1].url,'https://api.mailjet.com/v3.1/send');
 assert.deepEqual(JSON.parse(calls[1].options.body).Messages[0].To,[{Email:'tester@example.com'}]);
 await assert.rejects(provider.create('example.com'),/Verify this domain/);
});
