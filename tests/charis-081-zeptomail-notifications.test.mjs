import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('ZeptoMail batch notifications reuse SMTP safely and require explicit activation',()=>{
 const s=read('lib/email/zeptomail-notifications.ts');
 assert.match(s,/ZEPTOMAIL_NOTIFICATION_BATCH_ENABLED/);
 assert.match(s,/zeptoConfig\(process.env\)/);
 assert.match(s,/zeptoTransport\(cfg\)/);
 assert.match(s,/to:mail.to/);
 assert.match(s,/status:'unknown'/);
});
test('A ZeptoMail campaign is limited to 50 selected customers and a bank event',()=>{
 const a=read('app/dashboard/communications/actions.ts');
 const u=read('components/direct-compose.tsx');
 const sql=read('supabase/migrations/081_charis_zeptomail_notification_batches.sql');
 assert.match(a,/parsed.purpose!=='account_update'/);
 assert.match(a,/parsed.audience!=='selected'/);
 assert.match(a,/recipients.length>50/);
 assert.match(a,/zepto_event_confirm/);
 assert.match(a,/charis_direct_create_zepto_081/);
 assert.match(u,/Zoho ZeptoMail · Account notifications/);
 assert.match(sql,/p_purpose<>'account_update'/);
 assert.match(sql,/BETWEEN 1 AND 50/);
 assert.match(sql,/zepto_event_reference IS NOT NULL/);
 assert.match(sql,/public.charis_direct_create_v2/);
});
test('The established queued delivery system has no fallback on ZeptoMail uncertainty',()=>{
 const s=read('lib/direct/dispatch.ts');
 assert.match(s,/charis_direct_claim/);
 assert.match(s,/sendZeptoNotification/);
 assert.match(s,/else for\(const pref of prefs\)/);
 assert.match(s,/charis_direct_finish/);
 assert.match(s,/status==='unknown'\)break/);
});
