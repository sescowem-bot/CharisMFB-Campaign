import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Charis sidebar uses secure framework-managed signout',()=>{
  assert.match(read('components/workspace-shell.tsx'),/<SignOutForm\/>/);
  assert.doesNotMatch(read('components/workspace-shell.tsx'),/action="\/auth\/signout"/);
  assert.match(read('components/signout-form.tsx'),/useActionState\(signOutAction/);
  assert.match(read('app/auth/signout/actions.ts'),/await client\.auth\.signOut\(\)/);
  assert.match(read('app/auth/signout/actions.ts'),/redirect\('\/login'\)/);
});
test('Contact form reserves evidence for explicit consent, not unknown',()=>{
  const f=read('components/contact-forms.tsx');
  assert.match(f,/consent==='granted'\?/);
  assert.match(f,/name="consent_evidence"/);
  assert.match(f,/!dismissed&&<Feedback state=\{state\}\/>/);
  assert.match(read('app/dashboard/contacts/actions.ts'),/v\.consent_status!=='granted'\|\|v\.consent_evidence\.trim\(\)\.length>=6/);
});
test('Provider domain ID is clearly distinct from Charis internal ID',()=>{
  assert.match(read('components/provider-form.tsx'),/not the domain name/);
  assert.match(read('app/dashboard/senders/page.tsx'),/Charis internal record ID/);
  assert.match(read('app/dashboard/senders/page.tsx'),/This is NOT the provider Domain ID/);
});
