import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Campaign wizard has clear labelled steps, beginner-friendly hints, and a safety notice',()=>{
 const source=read('components/direct-compose.tsx');
 assert.match(source,/className="direct-simple-steps charis-flow-steps"/);
 assert.match(source,/Nothing is sent until you confirm/);
 for(const text of ['Write your message','Choose your recipients','Review your message','Final check before sending'])assert.ok(source.includes(text),text);
 assert.match(source,/Step \{step\+1\} of 4/);
});
test('Preview shows a consistent customer-readable summary and expandable recipient list',()=>{
 const source=read('components/direct-compose.tsx');
 assert.match(source,/aria-label="Campaign review summary"/);
 assert.match(source,/aria-label="Selected recipients"/);
 assert.match(source,/audienceLabel/);
 assert.match(source,/aria-label="Final campaign summary"/);
 assert.match(source,/productLabel/);
 assert.match(source,/typeLabel/);
});
test('No changes to sending safeguards or server-side confirmation',()=>{
 const source=read('components/direct-compose.tsx');
 const action=read('app/dashboard/communications/actions.ts');
 assert.match(source,/step!==3\|\|!confirmed/);
 assert.match(source,/name="commit_send" value="yes"/);
 assert.match(source,/onSubmit=\{e=>/);
 assert.match(source,/DirectEmailPreview key="confirmation"/);
 assert.match(action,/form\.get\('confirmed'\)!=='yes'/);
 assert.match(action,/sendDirectBatch/);
});
test('Layout has responsive navigation, preview and confirmation controls',()=>{
 const css=read('components/direct-campaign-wizard.css');
 assert.match(css,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 assert.match(css,/@media\(max-width:900px\)/);
 assert.match(css,/@media\(max-width:600px\)/);
 assert.match(css,/charis-flow-button-group/);
});

test('Disabled next-step controls include helpful guidance and contacts have an empty state',()=>{
 const source=read('components/direct-compose.tsx');
 assert.match(source,/step===0&&!messageReady/);
 assert.match(source,/step===1&&!recipientsReady/);
 assert.match(source,/No matching customers with a valid contact address/);
 assert.match(source,/Fix the preview issue before continuing/);
});
