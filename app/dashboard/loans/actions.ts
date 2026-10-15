'use server';
import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {supabaseServer} from '@/lib/supabase/server';
import {currentAccount} from '@/lib/auth/account';
export type CreditActionState={success?:string;error?:string};
const positiveMoney=z.string().regex(/^\d{1,13}(?:\.\d{1,2})?$/,'Use a valid amount with up to two decimals').refine(x=>Number(x)>0,'Amount must be greater than zero');
const isoDate=z.iso.date();
async function authorised(key:string){
 const account=await currentAccount();
 if(!account?.permissions.includes(key))throw Error('You do not have permission for this action.');
 return {org:account.workspace.id,db:await supabaseServer()};
}
export async function registerLoan(_:CreditActionState,form:FormData):Promise<CreditActionState>{
 try{
  const parsed=z.object({contact:z.uuid(),reference:z.string().trim().regex(/^[a-zA-Z0-9][a-zA-Z0-9_/-]{2,63}$/),principal:positiveMoney,total_due:positiveMoney,disbursed:isoDate,due:isoDate,notes:z.string().max(1000)}).parse({
   contact:form.get('contact'),reference:form.get('reference'),principal:form.get('principal'),total_due:form.get('total_due'),disbursed:form.get('disbursed'),due:form.get('due'),notes:form.get('notes')||''
  });
  if(Number(parsed.total_due)<Number(parsed.principal)||parsed.due<parsed.disbursed)throw Error('Check the total due and loan dates.');
  const {org,db}=await authorised('loans.manage');
  const {error}=await db.rpc('charis_loan_create',{p_org:org,p_contact:parsed.contact,p_reference:parsed.reference,p_principal:parsed.principal,p_total_due:parsed.total_due,p_disbursed:parsed.disbursed,p_due:parsed.due,p_notes:parsed.notes});
  if(error)throw Error(error.message);
  revalidatePath('/dashboard/loans');return {success:'Loan registered successfully.'};
 }catch(e){return {error:e instanceof z.ZodError?'Check the required loan details.':e instanceof Error?e.message:'Unable to register loan.'};}
}
export async function recordRepayment(_:CreditActionState,form:FormData):Promise<CreditActionState>{
 try{
  const parsed=z.object({loan:z.uuid(),amount:positiveMoney,paid:isoDate,receipt:z.string().trim().min(3).max(100),notes:z.string().max(500)}).parse({
   loan:form.get('loan'),amount:form.get('amount'),paid:form.get('paid'),receipt:form.get('receipt'),notes:form.get('notes')||''
  });
  const {org,db}=await authorised('loans.repayments');
  const {error}=await db.rpc('charis_loan_repayment_add',{p_org:org,p_loan:parsed.loan,p_amount:parsed.amount,p_paid:parsed.paid,p_receipt:parsed.receipt,p_notes:parsed.notes});
  if(error)throw Error(error.message);
  revalidatePath('/dashboard/loans');revalidatePath(`/dashboard/loans/${parsed.loan}`);return {success:'Repayment recorded. Balance updated.'};
 }catch(e){return {error:e instanceof z.ZodError?'Check amount, receipt reference and repayment date.':e instanceof Error?e.message:'Unable to record repayment.'};}
}
