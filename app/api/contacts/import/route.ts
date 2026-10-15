import {sameOrigin,boundedText,bodyErrorResponse} from '@/lib/security/request';
import {NextResponse} from 'next/server';
import {z} from 'zod';
import {contactsAccess} from '@/lib/contacts/access';
const schema=z.object({
 organization_id:z.string().uuid(),
 batch_key:z.string().uuid(),
 list_id:z.string().uuid().optional(),
 consent:z.object({
  confirmed:z.literal(true),
  source:z.enum(['signed_form','digital_form','consent_register','recorded_call','other']),
  reference:z.string().trim().min(8).max(200),
  recorded_on:z.iso.date().refine(value=>value<=new Date().toISOString().slice(0,10)),
  scope:z.enum(['all_marketing','product_specific']),
  product:z.string().trim().max(80)
 }).strict().refine(value=>value.scope!=='product_specific'||value.product.length>=2),
 rows:z.array(z.object({
  source_row:z.number().int().min(2).max(5001).optional(),
  first_name:z.string().trim().max(300),last_name:z.string().trim().max(300),
  email:z.string().trim().max(500),phone:z.string().trim().max(500),
  attributes:z.record(z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),z.string().max(500)).refine(value=>Object.keys(value).length<=12&&Object.entries(value).every(([key,entry])=>!/(password|passcode|pin|otp|bvn|nin|cvv|card_number|secret|token|passport|date_of_birth|dob|national_id|bank_verification|balance|debt|amount|debit|credit|outstanding|arrears|salary|income|transaction|consent|unsubscribe|suppression)/.test(key)&&(!(key.startsWith('account')||key.startsWith('acct'))||key==='account_type'||['account_number','account_no','account_reference','account_ref','account_last4','account_last_4','accountnumber','accountno','accountref','accountreference','acct_no','acct_number','acctno','acctnumber'].includes(key))&&(!['account_number','account_no','account_reference','account_ref','account_last4','account_last_4','accountnumber','accountno','accountref','accountreference','acct_no','acct_number','acctno','acctnumber'].includes(key)||entry.replace(/\D/g,'').length<=4))).optional()
 }).strict()).min(1).max(100)
}).strict();
export async function POST(request:Request){
 try{
  if(!sameOrigin(request))return NextResponse.json({error:'Cross-origin requests are not allowed'},{status:403});
  const contentType=request.headers.get('content-type')||'';
  if(!contentType.toLowerCase().startsWith('application/json'))return NextResponse.json({error:'JSON required'},{status:415});
  const text=await boundedText(request,95000);
  const parsed=schema.safeParse(JSON.parse(text));
  if(!parsed.success)return NextResponse.json({error:'Invalid contact data or batch identifier'},{status:400});
  const {db,user,authorized}=await contactsAccess(parsed.data.organization_id);
  if(!user)return NextResponse.json({error:'Sign in required'},{status:401});
  if(!authorized)return NextResponse.json({error:'Not authorized'},{status:403});
  const {data,error}=await db.rpc('charis_import_consented_batch',{
   p_org:parsed.data.organization_id,p_batch_key:parsed.data.batch_key,p_rows:parsed.data.rows,
   p_list:parsed.data.list_id||null,p_consent:parsed.data.consent
  });
  if(error)return NextResponse.json({error:'Contact import rejected: '+error.message},{status:422});
  const summary=Array.isArray(data)?data[0]:data;
  const {data:batch}=await db.from('contact_import_batches').select('id').eq('organization_id',parsed.data.organization_id).eq('batch_key',parsed.data.batch_key).maybeSingle();
  return NextResponse.json({inserted:summary?.inserted??0,skipped:summary?.skipped??0,rejected:summary?.rejected??0,batch_id:batch?.id||null},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){const rejected=bodyErrorResponse(e);if(rejected)return rejected;return NextResponse.json({error:'Import request could not be processed'},{status:400});}
}
