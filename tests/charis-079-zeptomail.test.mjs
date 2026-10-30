import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('ZeptoMail uses separate Mail Agent credentials with bank-domain sender and safe SMTP transport',()=>{
 const s=read('lib/email/zeptomail.ts');
 assert.match(s,/smtp\.zeptomail\.com/);
 assert.match(s,/ZEPTOMAIL_SMTP_PASSWORD/);
 assert.match(s,/ZEPTOMAIL_FROM_EMAIL/);
 assert.match(s,/charismfb\.com/);
 assert.match(s,/emailapikey/);
 assert.match(s,/requireTLS:cfg.port===587/);
 assert.match(s,/minVersion:'TLSv1.2'/);
 assert.doesNotMatch(s,/rejectUnauthorized:false/);
});
test('Verified Platform Super Admin can test SMTP, but bank staff permissions still protect customer notices',()=>{
 const s=read('app/dashboard/zeptomail/actions.ts');
 const p=read('app/dashboard/zeptomail/page.tsx');
 const ui=read('app/dashboard/zeptomail/forms.tsx');
 assert.match(s,/account.workspace.id!==charisOrgId/);
 assert.match(s,/user.email_confirmed_at/);
 assert.match(s,/account.owner && account.providerAdmin/);
 assert.match(s,/mode==='test'/);
 assert.match(s,/await access\('test'\)/);
 assert.match(s,/const \{email\}=await access\('test'\)/);
 assert.match(s,/const \{account,email,db\}=await access\('notice'\)/);
 assert.match(s,/charis_direct_can_send/);
 assert.match(s,/ZEPTOMAIL_TEST_ENABLED/);
 assert.match(s,/await transport.verify/);
 assert.match(s,/to:email,replyTo:cfg.from/);
 assert.doesNotMatch(s,/bulkSend|contact_ids|sendDirectBatch/);
 assert.match(p,/canSendNotices=isBankStaff&&!error&&allowed===true/);
 assert.match(p,/\{canSendNotices\?/);
 assert.match(p,/testEmail=\{user.email\}/);
 assert.match(ui,/verified signed-in address/);
});
test('Actual sending requires human confirmation and an event reference with one recipient',()=>{
 const actions=read('app/dashboard/zeptomail/actions.ts');
 const ui=read('app/dashboard/zeptomail/forms.tsx');
 assert.match(actions,/ZEPTOMAIL_TRANSACTIONAL_ENABLED/);
 assert.match(actions,/form.get\('confirmed'\)/);
 assert.match(actions,/z.string\(\).uuid\(\)/);
 assert.match(actions,/charis_zepto_reserve_079/);
 assert.match(actions,/charis_zepto_complete_079/);
 assert.match(actions,/replyTo:email,subject:letter.subject/);
 assert.match(actions,/disableFileAccess:true,disableUrlAccess:true/);
 assert.match(ui,/I confirm this is a genuine, customer-specific banking notification/);
 assert.match(ui,/setConfirmed\(false\)/);
 assert.match(ui,/ZeptoMail message preview/);
});
test('Database enforces concurrency lock, idempotence, bank-only sender, staff permissions, limits and RLS',()=>{
 const s=read('supabase/migrations/079_charis_zeptomail_transactional.sql');
 for(const term of ['ENABLE ROW LEVEL SECURITY','pg_advisory_xact_lock','charis_direct_can_send',
  'charis_zepto_reserve_079','charis_zepto_complete_079','UNIQUE(organization_id,actor_id,request_nonce)',"v_count>=20"])
  assert.ok(s.includes(term),term);
 assert.match(s,/p_from !~\*.*charismfb/);
 assert.match(s,/p_purpose NOT IN \('loan_reminder','account_notice','payment_receipt','customer_request'\)/);
});
test('ZeptoMail is visible as its own transactional card and navigation link, never unguarded bulk provider',()=>{
 const p=read('app/admin/providers/page.tsx'),nav=read('components/workspace-shell.tsx');
 assert.match(p,/<h2>ZeptoMail<\/h2>/);
 assert.match(p,/Transactional only/);
 assert.match(p,/href="\/dashboard\/zeptomail"/);
 assert.doesNotMatch(nav,/<NavLink href="\/dashboard\/zeptomail"/);
 assert.match(read('lib/direct/dispatch.ts'),/sendZeptoNotification/);
 assert.match(read('lib/direct/dispatch.ts'),/m.purpose!=='account_update'/);
});
