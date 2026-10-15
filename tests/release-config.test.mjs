import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const script=new URL('../scripts/check-release.mjs',import.meta.url);
const jwt=role=>'header.'+Buffer.from(JSON.stringify({role})).toString('base64url')+'.signature';
test('release configuration validation is read-only and does not print secret values',()=>{
 const env={NEXT_PUBLIC_APP_URL:'https://campaign.example',NEXT_PUBLIC_SUPABASE_URL:'https://project.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:jwt('anon'),SUPABASE_SERVICE_ROLE_KEY:jwt('service_role'),SINGLE_COMPANY_ORG_ID:'20000000-0000-4000-8000-000000000001',PAYSTACK_SECRET_KEY:'sk_test_do_not_print',EMAIL_WORKER_SECRET:'worker-do-not-print-'.repeat(3),RESEND_API_KEY:'resend-do-not-print',RESEND_WEBHOOK_SECRET:'whsec_do-not-print',EMAIL_DELIVERY_ENABLED:'false'};
 const result=spawnSync(process.execPath,[script.pathname],{env,encoding:'utf8'});
 const isNode24=process.versions.node.split('.')[0]==='24';
 assert.equal(result.status,isNode24?0:1);
 if(!isNode24)assert.match(result.stdout,/FAIL Node 24/);
 assert.match(result.stdout,/PASS Charis organisation UUID configured/);
 assert.match(result.stdout,/PASS Delivery stays disabled before acceptance/);
 assert.ok(!result.stdout.includes('do-not-print'));assert.ok(!result.stdout.includes('sk_test_'));
 env.NEXT_PUBLIC_SUPABASE_ANON_KEY=jwt('service_role');const bad=spawnSync(process.execPath,[script.pathname],{env,encoding:'utf8'});assert.equal(bad.status,1);assert.ok(bad.stdout.includes('FAIL Public key'));
 env.NEXT_PUBLIC_SUPABASE_ANON_KEY=jwt('anon');env.CHARIS_MULTI_PROVIDER_ENABLED='true';
 const unsafe=spawnSync(process.execPath,[script.pathname],{env,encoding:'utf8'});
 assert.equal(unsafe.status,1);assert.match(unsafe.stdout,/FAIL Multi-provider routing stays disabled before acceptance/);
});
