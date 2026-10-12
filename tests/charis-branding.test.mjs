import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('Charis brand is authoritative in public CMS and app metadata',()=>{
 const server=read('lib/cms/server.ts'), defaults=read('lib/cms/content.ts');
 assert.match(server,/display_name:'Charis Campaign Centre'/);
 assert.match(server,/SINGLE_COMPANY_MODE/);
 assert.match(defaults,/operator_name:'Charis Microfinance Bank'/);
 assert.doesNotMatch(read('lib/cms/defaults.json'),/SESCO Campaign Cloud|Sesco Studio/i);
});
test('Charis UI does not expose old self-signup or subscription navigation',()=>{
 const shell=read('components/workspace-shell.tsx'),publicUi=read('components/public.tsx'),middleware=read('middleware.ts');
 assert.match(shell,/Charis navigation/);
 assert.match(shell, /!single&&/);
 assert.match(publicUi, /!single&&<Link className=/);
 assert.match(middleware,/\/pricing/);
 assert.match(middleware,/\/register/);
});
test('brand-specific sender verification uses Charis names',()=>{
 for(const file of ['lib/email/server.ts','app/dashboard/senders/page.tsx']){
  assert.match(read(file),/charis-verification/);
  assert.doesNotMatch(read(file),/sesco-verification/i);
 }
});
