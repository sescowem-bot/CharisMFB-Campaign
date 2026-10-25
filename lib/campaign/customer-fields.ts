/** Display-only customer field metadata. Sensitive banking fields are never offered. */
export const basicCustomerFields=[
 {key:'first_name',label:'First name'},
 {key:'last_name',label:'Last name'},
 {key:'email',label:'Email address'},
 {key:'company_name',label:'Bank name'}
];
const hidden=/(password|passcode|(^|_)pin($|_)|otp|bvn|nin|cvv|card_?number|secret|token|passport|date_?of_?birth|(^|_)dob($|_)|national_?id|bank_?verification|(^|_)balance($|_)|account_?balance|(^|_)debt($|_)|(^|_)(amount|debit|credit|outstanding|arrears|salary|income|transaction)(_|$)|(^|_)amount_?due($|_)|(^|_)consent($|_)|marketing_?consent|unsubscribe|suppression)/;
const core=new Set(['id','organization_id','constructor','__proto__','prototype','email','phone','first_name','last_name','source','created_at','updated_at']);
const accountKeys=new Set(['account_number','account_no','account_reference','account_ref','account_last4','account_last_4','accountnumber','accountno','accountref','accountreference','acct_no','acct_number','acctno','acctnumber']);
export function safeCustomerAttribute(key:string):boolean{
 return /^[a-z][a-z0-9_]{0,39}$/.test(key)&&!core.has(key)&&!hidden.test(key)&&(!(key.startsWith('account')||key.startsWith('acct'))||accountKeys.has(key)||key==='account_type');
}
export const isAccountAttribute=(key:string)=>accountKeys.has(key);
export function customerFieldOptions(keys:string[]){
 const uniques=[...new Set(keys.filter(safeCustomerAttribute))].sort().slice(0,30);
 return [...basicCustomerFields,...uniques.map(key=>({key:'attributes.'+key,label:isAccountAttribute(key)?'Account (last four digits)':key.replaceAll('_',' ').replace(/^./,a=>a.toUpperCase())}))];
}
export function allowedCustomerToken(key:string){
 return basicCustomerFields.some(f=>f.key===key)||(key.startsWith('attributes.')&&safeCustomerAttribute(key.slice(11)));
}
export function contactFieldNames(rows:{attributes?:unknown}[]):string[]{
 return [...new Set(rows.flatMap(row=>row.attributes&&typeof row.attributes==='object'&&!Array.isArray(row.attributes)?Object.keys(row.attributes):[]).filter(safeCustomerAttribute))].sort().slice(0,30);
}
/** A bank account reference must never display its full stored value. */
export function safeCustomerAttributeValue(key:string,value:unknown){
 const text=typeof value==='string'?value:typeof value==='number'?String(value):'';
 if(!isAccountAttribute(key))return text.slice(0,200);
 const last4=text.replace(/\D/g,'').slice(-4);
 return last4?'•••• '+last4:'';
}

/** Reject unsupported or malformed manually typed merge markers before saving. */
export function assertCustomerMergeText(text:string):void{
 const expression=/\{\{\s*([^}]+?)\s*\}\}/g;
 const names=[...text.matchAll(expression)].map(m=>m[1].trim());
 if(names.some(name=>!allowedCustomerToken(name))||text.replace(expression,'').includes('{{')||text.replace(expression,'').includes('}}'))
  throw Error('An unsupported customer detail was entered. Please choose a detail from the menu.');
}
