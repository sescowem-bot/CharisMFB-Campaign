import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const file = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('Charis sign-out uses the browser Supabase client and clears this device session', () => {
  const content = file('components/signout-form.tsx');
  assert.match(content, /supabaseBrowser\(\)/);
  assert.match(content, /auth\.signOut\(\{scope: 'local'\}\)/);
  assert.match(content, /window\.location\.replace\('\/login'\)/);
  assert.match(content, /event\.preventDefault\(\)/);
  assert.doesNotMatch(content, /useActionState|action="\/auth\/signout"/);
});

test('The application shell uses the shared sign-out component', () => {
  const content = file('components/workspace-shell.tsx');
  assert.match(content, /import \{SignOutForm\}/);
  assert.match(content, /<SignOutForm\/>/);
  assert.doesNotMatch(content, /<form action="\/auth\/signout"/);
});

test('Contact page always passes the validated organisation ID', () => {
  const content = file('app/dashboard/contacts/page.tsx');
  assert.match(content, /const org=params\.org;\s*if\(!org\)redirect\('\/dashboard'\)/);
  assert.match(content, /contactsAccess\(org\)/);
  assert.doesNotMatch(content, /contactsAccess\(params\.org\)/);
  assert.match(content, /<ContactRowActions org=\{org\}/);
  assert.equal(content.match(/params\.org/g)?.length, 1);
});
