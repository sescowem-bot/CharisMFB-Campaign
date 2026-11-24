import test from 'node:test';
import assert from 'node:assert/strict';
import {personalize,renderCampaign} from '../lib/campaigns/render.ts';
import {designSchema} from '../lib/campaign/design.ts';
const design={version:'1',blocks:[{type:'heading',text:'Hello {{first_name}}'},{type:'paragraph',text:'Welcome to {{company_name}}. {{attributes.account_ref}}'},{type:'button',text:'Learn more',url:'https://charismfb.com/'}]};
test('personalization supports company and custom fields with missing-name fallback',()=>{
 assert.equal(personalize('Hello {{first_name}}, {{company_name}} {{attributes.account_ref}}',{attributes:{account_ref:'REF123'}},'Example'),'Hello Customer, Example •••• 123');
});
test('unsupported and malformed variables are rejected',()=>{
 for(const value of ['{{password}}','{{attributes.constructor}}','{{first_name','{{ first_name }} }}','{{attributes.__proto__}}'])assert.throws(()=>personalize(value,{},'Company'));
});
test('recipient text is escaped and never reinterpreted as a variable',()=>{
 const preview=renderCampaign({design,subject:'Welcome',company:'Company',address:'12 Main Street',contact:{first_name:'<img src=x onerror=alert(1)> {{email}}'}});
 assert.ok(preview.html.includes('&lt;img src=x'));assert.ok(preview.html.includes('{{email}}'));assert.ok(!preview.html.includes('<img'));
});
test('unsafe button URLs and empty designs cannot be rendered',()=>{
 for(const url of ['javascript:alert(1)','http://example.com','https://example.com','data:text/html,hello'])assert.throws(()=>renderCampaign({design:{version:'1',blocks:[{type:'button',text:'Click',url}]},subject:'Test',company:'Company',address:'Address'}));
 assert.throws(()=>renderCampaign({design:{version:'1',blocks:[]},subject:'Test',company:'Company',address:'Address'}));
});
test('email rendering includes fixed footer, HTTPS unsubscribe and a safe color',()=>{
 const preview=renderCampaign({design,subject:'Hi {{first_name}}',preheader:'A preview',company:'Company',address:'12 Main Street',color:'red; background:url(x)',contact:{first_name:'Alex'}});
 assert.equal(preview.subject,'Hi Alex');assert.ok(preview.html.includes('12 Main Street'));assert.ok(preview.html.includes('example.invalid/unsubscribe-preview'));assert.ok(preview.html.includes('bgcolor="#40239a"'));assert.ok(preview.html.includes('A preview'));assert.ok(preview.html.includes('role="presentation"'));
});
test('rendered subjects reject line breaks introduced by personalization',()=>{
 assert.throws(()=>renderCampaign({design,subject:'Hello {{first_name}}',company:'Company',address:'Address',contact:{first_name:'Name\r\nBcc: other@example.com'}}),/line breaks/);
});

test('email footer renders only configured HTTPS social links and keeps unsubscribe',()=>{
 const rendered=renderCampaign({design,subject:'Hello',company:'Charis',address:'Bank address',
  socialLinks:{facebook:'https://facebook.com/charis',whatsapp:'https://wa.me/2348000000000',instagram:'javascript:alert(1)'},
  footer:{company_name:'Charis MFB',social_platforms:['facebook','whatsapp','instagram'],disclaimer:'Official bank communication'},
  unsubscribeUrl:'https://charismfb.com/unsubscribe'});
 assert.ok(rendered.html.includes('Facebook'));
 assert.ok(rendered.html.includes('WhatsApp'));
 assert.ok(!rendered.html.includes('javascript:alert'));
 assert.ok(rendered.html.includes('Official bank communication'));
 assert.ok(rendered.html.includes('https://charismfb.com/unsubscribe'));
});

test('campaign design keeps the selected footer identifier',()=>{
 const footerId='123e4567-e89b-42d3-a456-426614174000';
 const parsed=designSchema.parse({version:'1',footerId,blocks:[{type:'paragraph',text:'Hello customer'}]});
 assert.equal(parsed.footerId,footerId);
});
