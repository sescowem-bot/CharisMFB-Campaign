import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Charis Admin Centre is bank-specific and permission-aware',()=>{
 const page=read('app/admin/page.tsx');
 assert.match(page,/Administration Centre/);
 assert.match(page,/accessAdmin/);
 assert.match(page,/providerAdmin/);
 assert.doesNotMatch(page,/subscription|pricing|Switch company/i);
});
