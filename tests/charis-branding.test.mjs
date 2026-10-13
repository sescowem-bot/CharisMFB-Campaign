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
test('Charis UI uses exclusive staff navigation without subscriptions',()=>{
 const shell=read('components/workspace-shell.tsx');
 const nav=read('components/charis-navigation.tsx');
 const publicUi=read('components/public.tsx');
 const middleware=read('middleware.ts');
 assert.match(shell,/NavLink/);
 assert.match(shell,/SignOutForm/);
 assert.match(nav,/CHARIS/gi);
 assert.doesNotMatch(shell,/Switch company|Pricing|Billing/);
 assert.match(publicUi,/!single&&/);
 assert.match(middleware,/\/pricing/);
 assert.match(middleware,/\/register/);
});
test('Charis has bundled official logo and favicon fallback',()=>{
 const layout=read('app/layout.tsx');
 const shell=read('components/workspace-shell.tsx');
 assert.match(layout,/favicon\.ico/);
 assert.match(shell,/charis-official-logo\.png/);
 assert.match(read('app/charis-premium.css'),/--charis-purple/);
});
