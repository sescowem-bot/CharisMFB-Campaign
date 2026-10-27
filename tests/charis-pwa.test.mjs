import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const read=p=>readFileSync(resolve(process.cwd(),p),'utf8');
test('manifest sets standalone installation and bank icon sizes',()=>{
 const data=read('app/manifest.ts');
 assert.match(data,/name:'Charis Campaign Centre'/);
 assert.match(data,/display:'standalone'/);
 assert.match(data,/start_url:'\/dashboard'/);
 assert.match(data,/charis-pwa-192\.png/);
 assert.match(data,/charis-pwa-512\.png/);
});
test('only public offline assets are cached',()=>{
 const sw=read('public/charis-sw.js');
 assert.match(sw,/PRECACHE=\['\/charis-offline\.html','\/charis-pwa-192\.png'\]/);
 assert.doesNotMatch(sw,/cache\.put|cache\.add\(event\.request\)/);
 assert.match(sw,/event\.request\.mode!=='navigate'/);
 assert.match(sw,/fetch\(event\.request\)/);
});
test('install page requires bank sign-in and offers manual install',()=>{
 assert.match(read('app/dashboard/install/page.tsx'),/currentAccount/);
 assert.match(read('app/dashboard/install/page.tsx'),/redirect\('\/login'\)/);
 const page=read('components/charis-pwa.tsx');
 assert.match(page,/beforeinstallprompt/);
 assert.match(page,/Microsoft Edge/);
 assert.match(page,/Google Chrome/);
});
