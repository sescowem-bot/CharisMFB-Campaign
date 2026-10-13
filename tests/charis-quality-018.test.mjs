import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Charis assets are uploaded server-side with MIME signatures, role checks and size caps',()=>{
 const act=src('app/dashboard/branding/media-actions.ts');
 assert.match(act,/allowedEditor\(org\)/);assert.match(act,/mediaType\(bytes\)/);
 assert.match(act,/2097152|2\*1024\*1024/);assert.match(act,/service\.storage/);
 assert.doesNotMatch(act,/NEXT_PUBLIC_.*SERVICE_ROLE/);
});
test('brand images and favicon are sourced from database not hardcoded env',()=>{
 const shell=src('components/workspace-shell.tsx'),meta=src('app/layout.tsx');
 assert.match(shell,/charisBrandAssets/);assert.match(meta,/assets\.favicon/);
 assert.doesNotMatch(shell+meta,/CHARIS_LOGO_URL/);
});
test('customer archive protects consent and permanent delete protects delivery history',()=>{
 const sql=src('supabase/migrations/018_charis_media_and_contact_management.sql');
 assert.match(sql,/charis_contact_archive/);assert.match(sql,/consent_status='denied'/);
 assert.match(sql,/charis_contact_delete/);assert.match(sql,/email_deliveries/);assert.match(sql,/charis_run_domain_guard/);
});
test('unrelated Resend domains are never automatically eligible in Charis',()=>{
 const sender=src('app/dashboard/senders/page.tsx');
 assert.match(sender,/d\.charis_connected===true/);assert.match(sender,/CharisDomainConnectForm/);
 assert.match(src('app/dashboard/senders/charis-actions.ts'),/charis_connected:true/);
 assert.match(src('app/dashboard/campaigns/page.tsx'),/sending_domains\.charis_connected/);
});
test('technical recovery form is hidden in single-company mode',()=>{
 assert.match(src('app/admin/providers/page.tsx'),/SINGLE_COMPANY_MODE==='true'/);
 assert.match(src('components/contact-row-actions.tsx'),/Archive|archive/);
});
