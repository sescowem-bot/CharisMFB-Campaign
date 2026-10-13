import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Charis uses a single browser-managed logout everywhere',()=>{
  assert.match(read('components/workspace-shell.tsx'),/<SignOutForm\/>/);
  assert.match(read('components/charis-navigation.tsx'),/<SignOutForm\/>/);
  assert.match(read('components/public.tsx'),/<SignOutForm variant=/);
  assert.match(read('components/signout-form.tsx'),/auth\.signOut/);
  assert.doesNotMatch(read('components/public.tsx'),/action="\/auth\/signout"/);
});
test('Contact form reserves evidence for explicit consent, not unknown',()=>{
  const f=read('components/contact-forms.tsx');
  assert.match(f,/consent==='granted'\?/);
  assert.match(f,/name="consent_evidence"/);
  assert.match(f,/!dismissed&&<Feedback state=\{state\}\/>/);
  assert.match(read('app/dashboard/contacts/actions.ts'),/v\.consent_status!=='granted'\|\|v\.consent_evidence\.trim\(\)\.length>=6/);
});
test('Charis sender settings do not expose legacy provider IDs or DNS records',()=>{
  const page=read('app/dashboard/senders/page.tsx');
  assert.match(page,/Connect an existing verified domain/);
  assert.doesNotMatch(page,/DnsRecord/);
  assert.doesNotMatch(page,/resend\._domainkey/);
  assert.doesNotMatch(page,/Registration recovery/);
});
