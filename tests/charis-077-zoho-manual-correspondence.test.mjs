import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Normal individual client correspondence is separate from campaign delivery',()=>{
 const action=read('app/dashboard/zoho-smtp/manual-actions.ts');
 const page=read('app/dashboard/zoho-smtp/page.tsx');
 const composer=read('app/dashboard/zoho-smtp/manual-form.tsx');
 assert.match(action,/export async function sendManualZohoLetter/);
 assert.match(action,/export async function sendMyZohoSelfTest/);
 assert.match(page,/ZohoSelfTestForm/);
 assert.match(page,/ZohoManualForm/);
 assert.match(composer,/Write to one client/);
 assert.match(composer,/name="to"/);
 assert.match(composer,/name="subject"/);
 assert.match(composer,/name="body"/);
 assert.match(composer,/Preview your email/);
 assert.match(composer,/confirmed\?'yes':'no'/);
 assert.match(composer,/Confirm & send this email/);
 assert.doesNotMatch(read('lib/direct/dispatch.ts'),/zohoStaffTransport|nodemailer/);
});
test('SMTP manual action requires human confirmation, verified matching staff, and feature gate',()=>{
 const action=read('app/dashboard/zoho-smtp/manual-actions.ts');
 assert.match(action,/ZOHO_SMTP_MANUAL_CLIENT_ENABLED/);
 assert.match(action,/account.workspace.id!==charisOrgId/);
 assert.match(action,/config.user!==mailbox\(user.email\)/);
 assert.match(action,/form.get\('confirmed'\)\|\|''/);
 assert.match(action,/charis_direct_can_send/);
 assert.match(action,/charis_zoho_manual_reserve_077/);
 assert.match(action,/charis_zoho_manual_complete_077/);
 assert.match(action,/to,replyTo:config.user,subject:letter.subject/);
 assert.match(action,/disableFileAccess:true,disableUrlAccess:true/);
 assert.doesNotMatch(action,/for\s*\(const contact|Promise\.all\(.*sendMail/);
});
test('Persistent SQL limits, duplicate prevention and RLS protect manual client emails',()=>{
 const sql=read('supabase/migrations/077_charis_zoho_manual_correspondence.sql');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public.charis_zoho_manual_letters/);
 assert.match(sql,/UNIQUE\(organization_id,actor_id,request_nonce\)/);
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/REVOKE ALL ON public.charis_zoho_manual_letters FROM PUBLIC,anon,authenticated/);
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/now\(\)-interval '60 seconds'/);
 assert.match(sql,/v_count>=20/);
 assert.match(sql,/charis_direct_can_send/);
 assert.match(sql,/auth.jwt\(\)->>'email'/);
 assert.match(sql,/charis_zoho_manual_complete_077/);
});
test('Letter templates are escaped and use one-to-one business formatting',()=>{
 const source=read('lib/email/zoho-manual.ts');
 assert.match(source,/escapeHtml\(p\)/);
 assert.match(source,/Charis Microfinance Bank/);
 assert.match(source,/safeBody.length<10\|\|safeBody.length>4000/);
 assert.match(source,/to===from/);
});
test('Staff-only Zoho page is discoverable without adding bulk Zoho provider',()=>{
 const shell=read('components/workspace-shell.tsx');
 assert.match(shell,/href="\/dashboard\/zoho-smtp"/);
 assert.match(shell,/process.env.ZOHO_SMTP_USER\?\.toLowerCase\(\)===email.toLowerCase\(\)/);
 const sender=read('app/admin/providers/page.tsx');
 assert.doesNotMatch(sender,/provider='zoho'/);
});
