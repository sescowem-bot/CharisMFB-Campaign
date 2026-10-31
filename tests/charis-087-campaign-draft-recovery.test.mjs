import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Campaign draft survives a page reload and is scoped to bank staff session',()=>{
 const c=read('components/direct-compose.tsx');
 const d=read('lib/direct/browser-draft.ts');
 const p=read('app/dashboard/communications/new/page.tsx');
 assert.match(c,/readCampaignDraft\(draftKey\)/);
 assert.match(c,/storeCampaignDraft\(draftKey/);
 assert.match(c,/window\.addEventListener\('pagehide',flush\)/);
 assert.match(c,/discardCampaignDraft\(draftKey\)/);
 assert.match(c,/const \[draftToken,setDraftToken\]/);
 assert.match(c,/name="token" value=\{draftToken\}/);
 assert.match(c,/Draft saved in this tab/);
 assert.match(c,/setConfirmed\(false\)/);
 assert.match(p,/userId=\{account.id\} organizationId=\{org\}/);
 assert.match(d,/campaignDraftKey=/);
 assert.match(d,/sessionStorage\.setItem/);
 assert.match(d,/maxAge=8\*60\*60\*1000/);
 assert.doesNotMatch(d,/recipient_email|recipient_phone|last_name/);
});
test('Selected contact IDs rehydrate using an authenticated bank endpoint, not saved PII',()=>{
 const c=read('components/direct-compose.tsx');
 const api=read('app/api/direct/contacts/restore/route.ts');
 assert.match(c,/fetch\('\/api\/direct\/contacts\/restore'/);
 assert.match(c,/setSelectedDetails\(Object\.fromEntries/);
 assert.match(api,/currentAccount\(\)/);
 assert.match(api,/charis_direct_can_send/);
 assert.match(api,/\.eq\('organization_id',org\)/);
 assert.match(api,/\.in\('id',ids\)/);
 assert.match(api,/'Cache-Control':'no-store'/);
});
test('Official sidebar logo uses high density mark plus live wordmark',()=>{
 const s=read('components/workspace-shell.tsx');
 const css=read('app/charis-claude-faithful.css');
 assert.match(s,/charis-official-mark\.png/);
 assert.match(s,/charis-crisp-wordmark/);
 assert.match(css,/\.charis-crisp-symbol/);
 assert.doesNotMatch(s,/unoptimized src=/);
});
