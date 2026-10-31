import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isCharisSenderEmail,isCharisSenderDomain} from '../lib/email/charis-sender.ts';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Charis only allows verified bank-domain sender addresses, while staff login remains independent',()=>{
 assert.equal(isCharisSenderEmail('noreply@charismfb.com'),true);
 assert.equal(isCharisSenderEmail('alerts@notice.charismfb.com'),true);
 assert.equal(isCharisSenderEmail('oldtest@example.org'),false);
 assert.equal(isCharisSenderEmail('fake@charismfb.com.example.org'),false);
 assert.equal(isCharisSenderEmail('fake@evilcharismfb.com'),false);
 assert.equal(isCharisSenderDomain('charismfb.com'),true);
 for(const file of ['lib/direct/readiness.ts','lib/direct/dispatch.ts','app/admin/providers/page.tsx','app/admin/communications/actions.ts'])
  assert.match(read(file),/isCharisSenderEmail/);
 const hub=read('app/admin/providers/page.tsx');
 assert.doesNotMatch(hub,/Salem Medicals|salemmedicals\.com/i);
});
