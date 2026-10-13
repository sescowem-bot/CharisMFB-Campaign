import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('Charis brand tokens are authoritative in app metadata and design system',()=>{
 const brand=read('lib/brand.ts'),css=read('app/globals.css'),layout=read('app/layout.tsx');
 assert.match(brand,/name: 'Charis Microfinance Bank'/);
 assert.match(brand,/primary: '#40239A'/i);assert.match(brand,/accent: '#38EF92'/i);
 assert.match(css,/--purple-700: #40239a/i);assert.match(css,/--green-500: #38ef92/i);
 assert.match(layout,/brand\.name/);
 assert.doesNotMatch(brand+css+layout,/SESCO Campaign Cloud|Sesco Studio/i);
});
test('Charis UI is single-company and exposes no self-signup, billing or company switching',()=>{
 const shell=read('components/workspace-shell.tsx'),middleware=read('middleware.ts'),login=read('components/auth-form.tsx');
 assert.match(shell,/Charis navigation/);
 assert.doesNotMatch(shell,/billing|pricing|register|All workspaces|Manage companies/i);
 assert.doesNotMatch(login,/register|Create account|signUp/);
 assert.match(middleware,/\/pricing/);
 assert.match(middleware,/\/register/);
});
test('brand-specific sender verification uses Charis names',()=>{
 for(const file of ['lib/email/server.ts','app/dashboard/senders/page.tsx']){
  assert.match(read(file),/charis-verification/);
  assert.doesNotMatch(read(file),/sesco-verification/i);
 }
});
