import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const composer=source('components/direct-compose.tsx');
const action=source('app/dashboard/communications/actions.ts');
const page=source('app/dashboard/communications/new/page.tsx');
const css=source('app/globals.css');

test('Four steps put preview before a distinct final confirmation',()=>{
 assert.match(composer,/\['Message','Recipients','Preview','Confirm & send'\]/);
 assert.match(composer,/step===2\?'block':'none'\}\} aria-label="Preview campaign"/);
 assert.match(composer,/step===3\?'block':'none'\}\} aria-label="Confirm campaign"/);
 assert.match(composer,/Nothing will be sent on this step/);
});
test('Only confirmed final action can submit and no earlier step uses submit',()=>{
 assert.match(composer,/if\(step!==3\|\|!confirmed/);
 assert.match(composer,/submitter\?\.getAttribute\('name'\)!=='commit_send'/);
 assert.match(composer,/name="commit_send" value="yes"/);
 assert.match(composer,/type="checkbox" name="confirmed" value="yes" checked=\{confirmed\}/);
 assert.match(composer,/step<3\?<button type="button"/);
 assert.match(composer,/onClick=\{\(\)=>\{setConfirmed\(false\);setStep/);
});
test('Server rejects unconfirmed submits before database access and send attempts',()=>{
 const guard=action.indexOf("if(form.get('confirmed')!=='yes'||form.get('commit_send')!=='yes')");
 assert.ok(guard>0);
 assert.ok(guard<action.indexOf('const account=await currentAccount()'));
 assert.ok(guard<action.indexOf("db.rpc('charis_direct_create_v2'"));
 assert.match(action,/sendDirectBatch\(3,\{org,message:id\}\)/);
});
test('Rich preview only renders at preview step while typing stays light',()=>{
 assert.match(composer,/if\(step!==2\|\|!design/);
 assert.match(composer,/const designError=useMemo/);
 assert.match(composer,/loading="lazy"/);
 assert.match(css,/direct-send-confirm/);
 assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});
test('Approval setting changes final label rather than misleading staff',()=>{
 assert.match(page,/approvalRequired=\{settings.approval_required\}/);
 assert.match(composer,/approvalRequired\?'Confirm & Submit for Approval'/);
});
