import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../lib/zoho/contact-sync.ts',import.meta.url),'utf8');

test('Zoho OAuth failures expose a safe provider error code',()=>{
 assert.match(source,/Zoho OAuth rejected the refresh-token request/);
 assert.match(source,/HTTP \\${res\.status}, code: \\${code}/);
 assert.match(source,/unrecognised_oauth_error/);
 assert.doesNotMatch(source,/console\\.log\\(.*client_secret/s);
});

test('Zoho OAuth diagnostics never include submitted credentials',()=>{
 const diagnostic=source.slice(source.indexOf('if(!res.ok||!data.access_token)'),source.indexOf('return String(data.access_token)'));
 assert.doesNotMatch(diagnostic,/process\\.env\\.ZOHO_(CLIENT_SECRET|REFRESH_TOKEN)/);
 assert.doesNotMatch(diagnostic,/data\\.error_description/);
});
