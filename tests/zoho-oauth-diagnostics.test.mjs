import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../lib/zoho/contact-sync.ts',import.meta.url),'utf8');

test('Zoho OAuth failures expose a safe provider error code',()=>{
 assert.ok(source.includes('Zoho OAuth rejected the refresh-token request'));
 assert.ok(source.includes('HTTP ${res.status}, code: ${code}'));
 assert.ok(source.includes('unrecognised_oauth_error'));
});

test('Zoho OAuth diagnostics never include submitted credentials',()=>{
 const start=source.indexOf('if(!res.ok||!data.access_token)');
 const end=source.indexOf('return String(data.access_token)');
 const diagnostic=source.slice(start,end);
 assert.ok(!diagnostic.includes('process.env.ZOHO_CLIENT_SECRET'));
 assert.ok(!diagnostic.includes('process.env.ZOHO_REFRESH_TOKEN'));
 assert.ok(!diagnostic.includes('data.error_description'));
});
