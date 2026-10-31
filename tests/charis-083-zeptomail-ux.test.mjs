import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=x=>readFileSync(new URL('../'+x,import.meta.url),'utf8');
test('ZeptoMail admin is connection management, while notification sending has one campaign workflow',()=>{
 const p=read('app/dashboard/zeptomail/page.tsx');
 assert.match(p,/href="\/dashboard\/communications\/new"/);
 assert.match(p,/href="\/dashboard\/communications"/);
 assert.match(p,/zeptoNotificationBatchReady\(\)/);
 assert.match(p,/zepto_event_reference/);
 assert.match(p,/Charis customer notifications/);
 assert.doesNotMatch(p,/<ZeptoNoticeComposer/);
 assert.doesNotMatch(p,/SQL 0[0-9][0-9]/);
 assert.match(p,/<details className="panel charis-zepto-settings">/);
});
test('Campaign composer does not expose migration numbers to staff in provider selection',()=>{
 const c=read('components/direct-compose.tsx');
 assert.doesNotMatch(c,/Provider selection will be available after the bank administrator applies database migration 075/);
 assert.match(c,/Email provider choices are being configured/);
});
