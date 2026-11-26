import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('dashboard no longer renders stale campaign counts or recent campaign rows',()=>{
 const page=read('app/dashboard/page.tsx');
 assert.doesNotMatch(page,/Previous campaigns|Awaiting review|Previous campaign records|recentCampaigns|data\.campaigns|data\.pending/);
 assert.match(page,/Saved groups/);
 assert.match(page,/Authorised customers/);
});

test('sent email campaign can be copied into a new editable campaign without mutating the source',()=>{
 const history=read('components/direct-delivery-history.tsx');
 const detail=read('app/dashboard/communications/history/page.tsx');
 const page=read('app/dashboard/communications/new/page.tsx');
 const composer=read('components/direct-compose.tsx');
 assert.match(history,/Edit as new/);
 assert.match(detail,/Edit as new/);
 assert.match(page,/status==='completed'/);
 assert.match(page,/initialCampaign/);
 assert.match(composer,/initialCampaignApplied/);
 assert.match(composer,/setSubject\(initialCampaign\.subject\)/);
 assert.match(composer,/setDesign\(initialCampaign\.design\)/);
});

test('contact directory uses a compact responsive layout with a useful page size',()=>{
 const page=read('app/dashboard/contacts/page.tsx');
 const table=read('components/customer-table.tsx');
 const css=read('components/customer-table.css');
 assert.match(page,/const pageSize=100/);
 assert.match(table,/charis-compact-contacts/);
 assert.match(css,/@media\(max-width:700px\)/);
});

test('editor settings are no longer trapped in a fixed-height inner scroll panel',()=>{
 const css=read('components/template-studio-premium.css');
 assert.match(css,/\.charis-gjs-inspector\{position:static!important/);
 assert.match(css,/max-height:none!important/);
 assert.match(css,/overflow:visible!important/);
});

test('selected text formatting is stored as validated inline runs and rendered in the email',()=>{
 const schema=read('lib/campaign/design.ts');
 const renderer=read('lib/campaigns/render.ts');
 const editor=read('components/grapes-email-editor.tsx');
 assert.match(schema,/richText:z\.array\(inlineRun\)/);
 assert.match(editor,/extractInlineRuns\(selectedElement\)/);
 assert.match(editor,/range\.extractContents\(\)/);
 assert.match(editor,/richText:runs\.some/);
 assert.match(renderer,/replaceRuns\(b\.text,b\.richText\)/);
});
