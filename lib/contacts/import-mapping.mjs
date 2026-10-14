/**
 * Safe, explicit spreadsheet column mapping for bank customer imports.
 * Values are still checked by the authenticated API and database before saving.
 */
const forbiddenParts = /(password|passcode|(^|_)pin($|_)|otp|bvn|nin|cvv|card_?number|secret|token|passport|date_?of_?birth|(^|_)dob($|_)|national_?id|bank_?verification|(^|_)balance($|_)|account_?balance|(^|_)debt($|_)|(^|_)(amount|debit|credit|outstanding|arrears|salary|income|transaction)(_|$)|(^|_)amount_?due($|_)|(^|_)consent($|_)|marketing_?consent|unsubscribe|suppression)/;
const disallowedKeys = new Set(['id','organization_id','constructor','__proto__','prototype','email','phone','first_name','last_name','source','created_at','updated_at']);
const maskedAccountKeys = new Set(['account_number','account_no','account_reference','account_ref','account_last4','account_last_4','accountnumber','accountno','accountref','accountreference','acct_no','acct_number','acctno','acctnumber']);
const suggestedKeys = new Set(['branch','branch_name','product','product_name','city','state','location','customer_type','relationship_manager']);

export function normalizeColumnKey(header) {
  const key = String(header ?? '').trim().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
    .replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,40).replace(/_+$/g,'');
  return /^[a-z]/.test(key) ? key : `field_${key}`.slice(0,40);
}
export function restrictedColumn(key) {
  const normalized = normalizeColumnKey(key);
  return !/^[a-z][a-z0-9_]{0,39}$/.test(normalized) || disallowedKeys.has(normalized) || forbiddenParts.test(normalized) || ((normalized.startsWith('account')||normalized.startsWith('acct'))&&!maskedAccountKeys.has(normalized)&&normalized!=='account_type');
}
export function suggestedColumn(key) {
  return suggestedKeys.has(normalizeColumnKey(key));
}
export function importColumnValue(key,value) {
  const normalized = normalizeColumnKey(key);
  if(restrictedColumn(normalized)) return '';
  const raw = String(value ?? '').trim();
  if(!raw) return '';
  if(maskedAccountKeys.has(normalized)) return raw.replace(/\D/g,'').slice(-4);
  return raw.slice(0,200);
}
export function previewColumnValue(key,value) {
  const safe = importColumnValue(key,value);
  return maskedAccountKeys.has(normalizeColumnKey(key)) && safe ? `•••• ${safe}` : safe;
}
