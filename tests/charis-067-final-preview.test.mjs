import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderDirectEmailPreview} from '../lib/direct/preview.ts';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const bank={name:'Charis Microfinance Bank',color:'#40239a',address:'Lagos'};

test('Simple-message preview mirrors the actual email body and escapes unsafe text',()=>{
 const result=renderDirectEmailPreview({design:null,subject:'Service update',body:'Hello,\nYour account is secure <script>alert(1)</script>.',brand:bank});
 assert.equal(result.error,'');
 assert.equal(result.subject,'Service update');
 assert.match(result.html,/Hello,<br\/>Your account is secure/);
 assert.doesNotMatch(result.html,/<script>/);
 assert.match(result.html,/&lt;script&gt;/);
 assert.match(result.html,/automatically when the email is sent/);
});
test('Designed-email preview personalises subject and message using the actual campaign renderer',()=>{
 const design={version:'1',blocks:[{type:'heading',text:'Welcome {{first_name}}'},{type:'paragraph',text:'Hello {{first_name}}, thank you for banking with us.'}]};
 const result=renderDirectEmailPreview({design,subject:'Hello {{first_name}}',body:'not used',brand:bank,contact:{first_name:'Ada',last_name:'Bello'}});
 assert.equal(result.error,'');
 assert.equal(result.subject,'Hello Ada');
 assert.equal(result.sampleName,'Ada Bello');
 assert.match(result.html,/Welcome Ada/);
});
test('Preview refuses unsafe design even when called by a browser',()=>{
 const design={version:'1',blocks:[{type:'heading',text:'Test'},{type:'paragraph',text:'See attached updates.'},{type:'button',text:'Open',url:'https://example.com/claim'}]};
 const result=renderDirectEmailPreview({design,subject:'Account update',body:'Body',brand:bank});
 assert.ok(result.error);
 assert.equal(result.html,'');
});
test('Campaign composer renders preview again at final confirmation and protects sending',()=>{
 const source=read('components/direct-compose.tsx');
 assert.match(source,/step<2/);
 assert.match(source,/channel==='email'\?\(step===2&&<DirectEmailPreview key="review"/);
 assert.match(source,/channel==='email'\?\(step===3&&<DirectEmailPreview key="confirmation"/);
 assert.match(source,/preview\.error/);
 assert.match(source,/step!==3\|\|!confirmed/);
 assert.match(source,/commit_send/);
 const ui=read('components/direct-email-preview.tsx');
 assert.match(ui,/loading="eager"/);
 assert.match(ui,/sandbox=""/);
 assert.match(ui,/Desktop/);
 assert.match(ui,/Mobile/);
});
test('Template create/edit workflow remains separately routed and save remains protected',()=>{
 const create=read('app/dashboard/templates/new/page.tsx');
 const edit=read('app/dashboard/templates/[id]/edit/page.tsx');
 assert.match(create,/mode="create"/);
 assert.match(edit,/mode="edit"/);
 assert.match(edit,/\.eq\('organization_id',org\)/);
 assert.match(read('app/dashboard/actions.ts'),/assertApprovedEmailImages\(org,design\)/);
 assert.match(read('components/template-studio.tsx'),/router.replace\(/);
});
