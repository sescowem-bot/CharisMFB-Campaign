import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const page=readFileSync(new URL('../app/admin/access/page.tsx', import.meta.url),'utf8');
test('Access management UI escapes the role ownership apostrophe in JSX text',()=>{
  assert.ok(page.includes('role&apos;s permitted actions'));
  assert.ok(!page.includes("role's permitted actions"));
});
