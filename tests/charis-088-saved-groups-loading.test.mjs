import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('saved customer groups open an organisation-scoped details route',()=>{
 const list=read('app/dashboard/lists/page.tsx');
 const detail=read('app/dashboard/lists/[id]/page.tsx');
 assert.ok(list.includes('href={`/dashboard/lists/${l.id}`}'));
 assert.doesNotMatch(list,/dashboard\/campaigns/);
 assert.match(detail,/contactsAccess\(org\)/);
 assert.match(detail,/\.eq\('organization_id',org\)/);
 assert.match(detail,/\.eq\('list_id',id\)/);
 assert.match(detail,/count:'exact'/);
 assert.match(detail,/PAGE_SIZE=50/);
 assert.match(detail,/\.range\(start,start\+PAGE_SIZE-1\)/);
});

test('Charis loading states are branded and respect reduced-motion preferences',()=>{
 for(const path of ['app/loading.tsx','app/dashboard/loading.tsx']){
  const source=read(path);
  assert.match(source,/role="status"/);
  assert.match(source,/CharisLoadingScreen/);
 }
 const screen=read('components/charis-loading-screen.tsx');
 assert.match(screen,/charis-official-mark\.png/);
 assert.match(screen,/Charis/);
 const css=read('app/globals.css');
 assert.match(css,/prefers-reduced-motion:no-preference/);
 assert.match(css,/prefers-reduced-motion:reduce/);
});
