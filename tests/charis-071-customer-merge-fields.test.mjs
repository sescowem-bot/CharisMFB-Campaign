import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {contactFieldNames,customerFieldOptions,safeCustomerAttribute,allowedCustomerToken,assertCustomerMergeText,safeCustomerAttributeValue} from '../lib/campaign/customer-fields.ts';
import {personalize,renderCampaign} from '../lib/campaigns/render.ts';
import {checkDirectDesign} from '../lib/direct/campaign-design.ts';
import {renderDirectEmailPreview} from '../lib/direct/preview.ts';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const base={version:'1',blocks:[{type:'heading',text:'Hello {{first_name}}'},{type:'paragraph',text:'Your {{attributes.product}} account at {{attributes.branch}} has reference {{attributes.account_number}}.'}]};

test('Only safe, actual imported contact columns appear in the staff dropdown',()=>{
 const keys=contactFieldNames([{attributes:{branch:'Lagos',account_number:'0123456789',bvn:'12345678901',pin:'1234',balance:'2000',product:'Savings'}},{attributes:{branch:'Lekki',customer_type:'Retail',otp:'0000'}}]);
 assert.deepEqual(keys,['account_number','branch','customer_type','product']);
 const opts=customerFieldOptions(keys);
 assert.ok(opts.find(o=>o.key==='attributes.account_number'&&o.label.includes('last four')));
 assert.ok(opts.find(o=>o.key==='first_name'&&o.label==='First name'));
 assert.equal(opts.some(o=>o.key==='attributes.pin'||o.key==='attributes.bvn'),false);
 assert.equal(safeCustomerAttribute('account_balance'),false);
 assert.equal(allowedCustomerToken('attributes.branch'),true);
 assert.equal(allowedCustomerToken('attributes.bvn'),false);
 assert.throws(()=>assertCustomerMergeText('Dear {{attributes.pin}}'),/unsupported customer detail/i);
 assert.doesNotThrow(()=>assertCustomerMergeText('Dear {{first_name}}, reference {{attributes.account_number}}'));
});
test('Personalisation inserts customer details at delivery and masks ALL bank account variants',()=>{
 const source={first_name:'Ada',last_name:'Okoro',email:'ada@example.invalid',attributes:{product:'Savings',branch:'Surulere',account_number:'0038827319',acct_no:'1000231456',account_ref:'987654321',pin:'1234'}};
 const text=personalize('Dear {{first_name}} {{last_name}}, {{attributes.branch}} — {{attributes.account_number}} / {{attributes.acct_no}} / {{attributes.account_ref}}',source,'Charis Microfinance Bank');
 assert.match(text,/Ada Okoro/);
 assert.match(text,/Surulere/);
 assert.match(text,/•••• 7319/);
 assert.match(text,/•••• 1456/);
 assert.match(text,/•••• 4321/);
 assert.equal(text.includes('0038827319'),false);
 assert.equal(safeCustomerAttributeValue('account_last4','8437'),'•••• 8437');
 assert.throws(()=>personalize('{{attributes.pin}}',source,'Charis'),/Unsupported/);
});
test('The direct-send validator permits approved fields and rejects unsafe ones',()=>{
 assert.doesNotThrow(()=>checkDirectDesign(base,'','Account update for {{first_name}}'));
 assert.throws(()=>checkDirectDesign({version:'1',blocks:[{type:'paragraph',text:'Your code {{attributes.pin}} is secret.'}]},'','Security'),/Unsupported/);
 assert.doesNotThrow(()=>renderCampaign({design:base,subject:'{{first_name}} — {{attributes.account_number}}',company:'Charis Microfinance Bank',address:'',contact:{first_name:'Ada',attributes:{account_number:'12345678',branch:'Surulere',product:'Savings'}}}));
});
test('Preview never requires or exposes real banking customer attribute values',()=>{
 const preview=renderDirectEmailPreview({design:base,subject:'Account update',body:'',brand:{name:'Charis Microfinance Bank',color:'#40239A',address:'Lagos'},customFields:['branch','product','account_number','pin']});
 assert.equal(preview.error,'');
 assert.match(preview.html,/•••• 1234/);
 assert.doesNotMatch(preview.html,/attributes\.pin/);
});
test('All staff-facing routes use scoped field names, no imported private values in client props',()=>{
 const newT=read('app/dashboard/templates/new/page.tsx');
 const editT=read('app/dashboard/templates/[id]/edit/page.tsx');
 const campaign=read('app/dashboard/communications/new/page.tsx');
 for(const s of [newT,editT,campaign]){assert.match(s,/contactFieldNames/);assert.match(s,/\.eq\('organization_id',org\)/);assert.match(s,/availableFields|customFields/);}
 assert.match(campaign,/\.select\('id,first_name,last_name,email,phone'\)/);
 assert.match(read('lib/direct/dispatch.ts'),/last_name,attributes,archived_at/);
 assert.match(read('app/dashboard/actions.ts'),/assertCustomerMergeText/);
 const view=read('components/template-studio.tsx');
 assert.match(view,/Personalise your message/);
 assert.match(view,/Insert in message/);
 assert.match(read('components/grapes-email-editor.tsx'),/Insert into selected section/);
 assert.doesNotMatch(read('app/dashboard/communications/page.tsx'),/Staff-only test email/);
 assert.doesNotMatch(read('app/dashboard/campaigns/page.tsx'),/Recent campaign tests/);
});
