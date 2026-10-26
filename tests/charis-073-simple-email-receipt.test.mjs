import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeSimpleEmailDesign,simpleEmailStyles} from '../lib/direct/simple-email.ts';
import {renderCampaign} from '../lib/campaigns/render.ts';
import {checkDirectDesign} from '../lib/direct/campaign-design.ts';
import {renderDirectEmailPreview} from '../lib/direct/preview.ts';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const brand={name:'Charis Microfinance Bank',color:'#40239a',address:'Lagos'};

test('Simple Email creates four real email-safe branded designs without selecting a saved template',()=>{
 const values=simpleEmailStyles.map(x=>x.value);
 assert.deepEqual(values,['classic','modern','minimal','announcement']);
 for(const style of values){
  const design=makeSimpleEmailDesign('We have a service update for your {{attributes.account_number}}.', 'Hello {{first_name}},',style);
  assert.equal(design.style,style);
  assert.doesNotThrow(()=>checkDirectDesign(design,'','Important bank update'));
  const preview=renderDirectEmailPreview({design,subject:'News for {{first_name}}',body:'unused',brand,customFields:['account_number']});
  assert.equal(preview.error,'');
  assert.match(preview.html,/Hello Customer/);
  assert.match(preview.html,/•••• 1234/);
  assert.match(preview.html,/Charis Microfinance Bank/);
 }
});
test('Simple Email preview matches the actual dispatch renderer with real recipient personalization and masking',()=>{
 const design=makeSimpleEmailDesign('Your savings account {{attributes.account_number}} has an update.','Hello {{first_name}},','modern');
 const email=renderCampaign({design,subject:'Update for {{first_name}}',company:brand.name,color:brand.color,address:'Lagos',contact:{first_name:'Ada',attributes:{account_number:'0100921234'}},testPreview:true});
 assert.match(email.html,/Hello Ada/);
 assert.match(email.html,/•••• 1234/);
 assert.doesNotMatch(email.html,/0100921234/);
 assert.equal(email.subject,'Update for Ada');
});
test('Unsaved simple email can insert customer details in body and subject, with undo and redo',()=>{
 const src=read('components/direct-compose.tsx');
 assert.match(src,/if\(!design\)\{setBody\(old=>/);
 assert.match(src,/const effectiveDesign=useMemo/);
 assert.match(src,/channel==='email'&&effectiveDesign\?JSON.stringify\(effectiveDesign\)/);
 assert.match(src,/renderDirectEmailPreview\(\{design:effectiveDesign/);
 assert.match(src,/simpleEmailStyles\.map/);
 assert.match(src,/Insert customer details/);
 assert.match(src,/simpleGreeting:SimpleEmailStyle|simpleStyle:SimpleEmailStyle/);
 assert.match(src,/function undoDraft/);
 assert.match(src,/function redoDraft/);
});
test('Staff see a status-sensitive modal instead of provider diagnostics, while server safely guards actual sending',()=>{
 const component=read('components/direct-compose.tsx');
 const receipt=read('components/direct-campaign-receipt.tsx');
 const server=read('app/dashboard/communications/actions.ts');
 assert.doesNotMatch(component,/state\.success&&<div role="status" className="notice"/);
 assert.match(component,/state\.id&&<DirectCampaignReceipt/);
 assert.match(receipt,/role="dialog" aria-modal="true"/);
 assert.match(receipt,/Campaign submitted successfully/);
 assert.match(receipt,/Campaign sent for approval/);
 assert.match(receipt,/Delivery to each inbox may take additional time/);
 assert.match(receipt,/View campaign/);
 assert.doesNotMatch(receipt,/accepted by provider/);
 assert.match(server,/outcome\?:'submitted'\|'scheduled'\|'approval'\|'attention'\|'unavailable'/);
 assert.match(server,/form\.get\('confirmed'\)!=='yes'/);
 assert.match(server,/sendDirectBatch/);
 assert.match(server,/if\(failed&&!accepted\)return \{id,outcome:'attention'/);
});
