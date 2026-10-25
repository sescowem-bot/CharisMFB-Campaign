import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Campaign wizard uses GrapesJS without removing the detailed section editor',()=>{
 const source=read('components/direct-compose.tsx');
 assert.match(source,/dynamic\(\(\)=>import\('@\/components\/grapes-email-editor'\)/);
 assert.match(source,/GrapesEmailEditor design=\{design\}/);
 assert.match(source,/editorMode==='sections'/);
 assert.match(source,/selectTemplate\(e.target.value\)/);
 assert.match(source,/templates\.filter\(t=>t.source==='bank'\)/);
 assert.match(source,/templates\.filter\(t=>t.source==='starter'\)/);
});
test('Saved templates, supported starter layouts and bank-controlled media are loaded from Charis',()=>{
 const source=read('app/dashboard/communications/new/page.tsx');
 assert.match(source,/charisTemplatePresets/);
 assert.match(source,/\['general','announcement'\]/);
 assert.match(source,/charis_media_assets/);
 assert.match(source,/\.limit\(80\)/);
 assert.match(source,/assertNoDemoLinks\(design\)/);
 assert.match(source,/templates=\{\[\.\.\.templates\.map/);
});
test('Customer name insertion is restricted to approved variables and designed email content',()=>{
 const source=read('components/direct-compose.tsx');
 assert.match(source,/value="first_name"/);
 assert.match(source,/value="last_name"/);
 assert.match(source,/value="company_name"/);
 assert.match(source,/if\(!design\|\|channel!=='email'\)return/);
 const validation=read('lib/direct/campaign-design.ts');
 assert.match(validation,/\['first_name','last_name','company_name'\]/);
});
test('Campaign delivery remains behind the explicit fourth-step confirmation and server permissions',()=>{
 const source=read('components/direct-compose.tsx');
 const action=read('app/dashboard/communications/actions.ts');
 assert.match(source,/step!==3\|\|!confirmed/);
 assert.match(source,/name="commit_send" value="yes"/);
 assert.match(action,/charis_direct_can_send/);
 assert.match(action,/CHARIS_SIMPLE_SENDING_ENABLED/);
 assert.match(action,/EMAIL_DELIVERY_ENABLED/);
 assert.match(action,/assertNoDemoLinks|checkDirectDesign/);
});
