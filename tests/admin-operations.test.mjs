import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Charis Admin Centre is bank-specific and permission-aware',()=>{
 const page=read('app/admin/page.tsx');
 assert.match(page,/title="Administration"/);
 assert.match(page,/account\.owner/);
 assert.match(page,/has\('access\.manage'\)/);
 assert.match(page,/has\('providers\.manage'\)/);
 assert.match(page,/sections\.filter\(s=>s\.show\)/);
 assert.doesNotMatch(page,/subscription|pricing|Switch company/i);
});
