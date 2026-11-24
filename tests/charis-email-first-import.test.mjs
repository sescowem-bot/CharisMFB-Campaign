import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone } from '../lib/contacts/parse-csv.mjs';

test('restores Nigerian leading zero removed by Excel', () => {
  assert.equal(normalizePhone('8012345678', 'NG'), '+2348012345678');
  assert.equal(normalizePhone('9038237026', 'NG'), '+2349038237026');
  assert.equal(normalizePhone('08012345678', 'NG'), '+2348012345678');
});

test('does not duplicate an existing Nigerian country code', () => {
  assert.equal(normalizePhone('2348012345678', 'NG'), '+2348012345678');
  assert.equal(normalizePhone('+2348012345678', 'NG'), '+2348012345678');
});

test('preserves valid international numbers and converts 00 prefix', () => {
  assert.equal(normalizePhone('+447911123456', 'NG'), '+447911123456');
  assert.equal(normalizePhone('00447911123456', 'NG'), '+447911123456');
});

test('ignores missing or malformed optional phone values', () => {
  assert.equal(normalizePhone('', 'NG'), '');
  assert.equal(normalizePhone('not-a-number', 'NG'), '');
  assert.equal(normalizePhone('080123', 'NG'), '');
});

test('does not assume Nigerian country code when country is not selected', () => {
  assert.equal(normalizePhone('8012345678', 'none'), '');
});
