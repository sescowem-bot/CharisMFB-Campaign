import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Charis only reuses an existing verified Resend domain, never creates one on lookup miss',()=>{
 const s=read('app/dashboard/senders/charis-actions.ts');
 const block=s.split('export async function setupCharisResendDomain')[1].split('export async function checkCharisResendDomain')[0];
 assert.match(block,/await findResendDomain\(domain\)/);
 assert.match(block,/if\(!known\)throw new Error/);
 assert.match(block,/if\(!state\.verified\)throw new Error/);
 assert.match(block,/charis_connected:true/);
 assert.match(block,/registration:'existing_resend_domain'/);
 assert.doesNotMatch(block,/\.create\s*\(/);
});
test('legacy pending Charis domain refresh only looks up existing Resend domain',()=>{
 const s=read('app/dashboard/senders/charis-actions.ts');
 const block=s.split('export async function checkCharisResendDomain')[1].split('export async function removePendingCharisDomain')[0];
 assert.match(block,/findResendDomain\(row\.domain\)/);
 assert.match(block,/providerAdapter\('resend'/);
 assert.doesNotMatch(block,/\.check\([^\n]*,\s*true\)/);
 assert.doesNotMatch(block,/\.create\s*\(/);
});
test('single-company interface does not instruct staff to add DNS records or enter a provider ID',()=>{
 const s=read('app/dashboard/senders/page.tsx');
 const single=s.split("if(process.env.SINGLE_COMPANY_MODE==='true'")[1].split("const {data:own}=")[0];
 assert.match(single,/Connect an existing verified domain/);
 assert.match(single,/No new DNS setup is initiated here/);
 assert.doesNotMatch(single,/Add the following DNS records/);
 assert.doesNotMatch(single,/Provider Domain ID/);
 assert.doesNotMatch(single,/\.map\(\(r:DnsRecord/);
});
test('sender name and reply-to remain editable and domain IDs remain server-side',()=>{
 const form=read('components/charis-resend-form.tsx');
 assert.match(form,/name="from_name"/);
 assert.match(form,/name="from_local"/);
 assert.match(form,/name="reply_to"/);
 assert.match(form,/Use existing verified domain/);
 const server=read('lib/email/charis-domain-setup.ts');
 assert.match(server,/RESEND_API_KEY/);
 assert.match(server,/same Resend team/);
});

test('old multi-company server actions cannot register or reconcile domains for Charis',()=>{
 const legacy=read('app/dashboard/senders/actions.ts');
 assert.match(legacy,/SINGLE_COMPANY_MODE==='true'.*action!=='test'/);
 const admin=read('app/admin/providers/actions.ts');
 assert.match(admin,/SINGLE_COMPANY_MODE==='true'.*Technical domain ID recovery is disabled/);
});
test('fresh test email requires a Charis-connected and provider-verified sender',()=>{
 const server=read('lib/email/server.ts');
 assert.match(server,/row\.charis_connected===true/);
 assert.match(server,/state\.verified&&owned/);
});
