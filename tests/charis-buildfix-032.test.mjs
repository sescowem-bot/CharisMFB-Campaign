import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('loan register optional balance query includes a consistent error field', () => {
  const source = read('app/dashboard/loans/page.tsx');
  assert.match(source, /ids\.length\?db\.from\('charis_loan_balances'\)[\s\S]{0,260}:Promise\.resolve\(\{data:\[\],error:null\}\)/);
  assert.match(source, /\{data:payments,error:balanceError\}/);
});

test('unused campaign workspace RPC and shell binding removed without altering send gates', () => {
  const campaigns = read('app/dashboard/campaigns/page.tsx');
  const shell = read('components/workspace-shell.tsx');
  assert.doesNotMatch(campaigns, /\bownWorkspace\b/);
  assert.doesNotMatch(shell, /const workspace=org\|\|/);
  assert.match(campaigns, /const own=false/);
  assert.match(shell, /EMAIL_DELIVERY_ENABLED==='true'/);
});
