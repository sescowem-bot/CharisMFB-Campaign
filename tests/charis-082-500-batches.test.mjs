import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=x=>readFileSync(new URL('../'+x,import.meta.url),'utf8');
test('Release 082 reserves at most 500, groups 50, and sequences phases',()=>{
 const s=read('supabase/migrations/082_charis_500_recipient_batches.sql');
 for(const term of ['max_recipients BETWEEN 1 AND 500','recipient_count BETWEEN 1 AND 500',
  'row_number() OVER','/50) AS phase','delivery_batch=n.phase',
  'prior.delivery_batch<r.delivery_batch', 'pg_advisory_xact_lock',
  'daily_recipient_limit','NOT BETWEEN 1 AND 500',
  'charis_direct_create_zepto_081','charis_direct_settings_save_082'])
  assert.ok(s.includes(term),term);
});
test('Sending settings and server action enforce 500 recipients',()=>{
 const a=read('app/admin/communications/actions.ts');
 const form=read('components/direct-admin-forms.tsx');
 const send=read('app/dashboard/communications/actions.ts');
 const ui=read('components/direct-compose.tsx');
 assert.match(a,/min\(1\).max\(500\)/);
 assert.match(form,/max=\{500\}/);
 assert.match(send,/recipients.length>500/);
 assert.match(ui,/Math.ceil\(chosen.length\/50\)/);
 assert.match(ui,/chosen.length<=500/);
});
test('ZeptoMail sending privileges follow verified roles, not operator email domain',()=>{
 const a=read('app/dashboard/zeptomail/actions.ts');
 const p=read('app/dashboard/zeptomail/page.tsx');
 assert.doesNotMatch(a,/email.split\('@'\)\[1\]/);
 assert.doesNotMatch(p,/endsWith\('@charismfb.com'\)/);
 assert.match(a,/charis_direct_can_send/);
 assert.match(p,/const canSend=account.providerAdmin&&!accessError&&allowed===true/);
});
