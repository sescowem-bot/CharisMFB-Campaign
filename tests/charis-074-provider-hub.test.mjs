import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {providerHubState} from '../lib/email/provider-hub-status.ts';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('The provider hub includes all four services with honest SendGrid readiness',()=>{
 const page=read('app/admin/providers/page.tsx');
 assert.match(page,/resend','brevo','mailjet/);
 assert.match(page,/<h2>SendGrid<\/h2>/);
 assert.match(page,/Verification only/);
 assert.match(page,/cannot yet send Charis customer campaigns/);
 assert.match(page,/SendgridCheckForm/);
 assert.doesNotMatch(page,/DirectProviderForm[^>]+provider="sendgrid"/);
 assert.match(read('lib/email/sendgrid.ts'),/diagnostics ONLY/);
});
test('The normal workflow uses service sender settings without duplicate provider grids',()=>{
 const hub=read('app/admin/providers/page.tsx');
 const settings=read('app/admin/communications/page.tsx');
 assert.match(hub,/DirectProviderForm/);
 assert.match(hub,/charis_direct_provider_prefs/);
 assert.match(hub,/Sender setup required|providerHubState/);
 assert.match(hub,/BrevoSenderConnect/);
 assert.match(hub,/MailjetSenderConnect/);
 assert.match(hub,/Advanced settings/);
 assert.match(settings,/href="\/admin\/providers"/);
 assert.doesNotMatch(settings,/DirectProviderForm/);
 assert.match(read('app/admin/communications/actions.ts'),/revalidatePath\('\/admin\/providers'\)/);
});
test('Provider authentication alone does not imply live sending readiness',()=>{
 const ready={providerEnabled:true,directEnabled:true,selectedSenderEmail:'campaigns@charis.example.ng',
 approvedSenderCount:1,externallyVerifiedCount:1,deliveryEnabled:true,apiConfigured:true};
 assert.equal(providerHubState(ready).ready,true);
 assert.equal(providerHubState({...ready,apiConfigured:false}).ready,false);
 assert.equal(providerHubState({...ready,deliveryEnabled:false}).ready,false);
 assert.equal(providerHubState({...ready,directEnabled:false}).ready,false);
 assert.equal(providerHubState({...ready,selectedSenderEmail:null}).ready,false);
 assert.equal(providerHubState({...ready,selectedSenderEmail:'campaigns@salemmedicals.com'}).domainNeedsReview,true);
 assert.equal(providerHubState({...ready,selectedSenderEmail:'campaigns@salemmedicals.com'}).ready,false);
});
test('Sensitive API credentials remain only in environment variables, never inside the browser form',()=>{
 const hub=read('app/admin/providers/page.tsx');
 assert.match(hub,/Boolean\(process.env.SENDGRID_API_KEY&&process.env.SENDGRID_FROM_EMAIL\)/);
 assert.match(hub,/Do not paste API keys into this page/);
 assert.doesNotMatch(hub,/<input[^>]+name="SENDGRID_API_KEY"/);
});
