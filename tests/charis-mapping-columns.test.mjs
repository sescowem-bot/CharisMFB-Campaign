import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeColumnKey,restrictedColumn,suggestedColumn,importColumnValue,previewColumnValue} from '../lib/contacts/import-mapping.mjs';

test('spreadsheet column headings convert to valid field names',()=>{
 assert.equal(normalizeColumnKey('Branch Name'),'branch_name');
 assert.equal(normalizeColumnKey('Account Reference'),'account_reference');
 assert.equal(normalizeColumnKey('123 Field'),'field_123_field');
});
test('bank credential and sensitive account columns are excluded',()=>{
 for(const name of ['BVN','NIN','Password','OTP','PIN','Account Balance','Negative balance','Outstanding Amount','Debit','Salary','DOB','Card Number','marketing consent','email']){
  assert.equal(restrictedColumn(name),true,name);
 }
 assert.equal(restrictedColumn('Branch Name'),false);
 assert.equal(restrictedColumn('Product'),false);
});
test('suggested customer details are useful campaign fields',()=>{
 assert.equal(suggestedColumn('Branch'),true);
 assert.equal(suggestedColumn('Account Reference'),false); // require deliberate selection
 assert.equal(suggestedColumn('Balance'),false);
});
test('full account references are truncated to four digits before upload and previewed masked',()=>{
 assert.equal(importColumnValue('account_reference','0123-4567-8901'),'8901');
 assert.equal(importColumnValue('AccountNumber','1234567890'),'7890');
 assert.equal(previewColumnValue('account_reference','0123-4567-8901'),'•••• 8901');
});
test('unselected sensitive values cannot become user attributes through mapping helper',()=>{
 assert.equal(importColumnValue('bvn','12345678909'),'');
 assert.equal(importColumnValue('account_balance','500000'),'');
 assert.equal(importColumnValue('branch','Surulere'),'Surulere');
});
