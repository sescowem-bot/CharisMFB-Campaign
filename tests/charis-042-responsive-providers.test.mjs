import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const page=read('app/admin/providers/page.tsx');
const css=read('app/charis-providers.css');
const layout=read('app/layout.tsx');

test('providers are ordered with Resend primary and retain all three provider forms',()=>{
 assert.match(page,/const providers=\[\.\.\.\(data\|\|\[\]\)\]\.sort/);
 assert.match(page,/\{resend:0,mailjet:1,brevo:2\}/);
 for(const form of ['ProviderForm','ProviderLimitsForm','ProviderRouteForm','MailjetSenderConnect','BrevoSenderConnect'])assert.match(page,new RegExp(`<${form}\\b`));
});
test('provider detail sections are independently expandable, optional providers folded',()=>{
 assert.match(page,/charis-provider-disclosure/);
 assert.match(page,/open=\{p\.provider==='resend'\}/);
 assert.match(page,/charis-webhook-details/);
});
test('webhook URL stays contained and respects current secured endpoint',()=>{
 assert.match(page,/https:\/\/charismfbcampaign\.vercel\.app\/api\/email\/webhooks\/mailjet/);
 assert.match(page,/MAILJET_WEBHOOK_SECRET/);
 assert.match(css,/charis-webhook-url code\{[^}]*word-break:break-all/);
 assert.doesNotMatch(page,/secret\}\}|API_KEY\}\}/);
});
test('responsive layout prevents horizontal overflow on smaller screens',()=>{
 assert.match(layout,/import '\.\/charis-providers\.css'/);
 assert.match(css,/@media\(max-width:1120px\)/);
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(css,/charis-provider-form-grid\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/charis-provider-page\{min-width:0;max-width:100%/);
 assert.match(css,/charis-provider-state-grid,body\.charis-premium \.charis-provider-overview\{grid-template-columns:1fr\}/);
});
test('page remains permission protected and does not change any delivery gate',()=>{
 assert.match(page,/db\.rpc\('can_manage_senders'/);
 assert.match(page,/if\(accessError\|\|canManage!==true\)redirect/);
 assert.doesNotMatch(page,/process\.env\.EMAIL_DELIVERY_ENABLED\s*=(?!=)/);
 assert.doesNotMatch(page,/sendApprovedResendBroadcast\(/);
});
