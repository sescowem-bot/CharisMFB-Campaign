import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {WorkspaceShell} from '@/components/workspace-shell';
import {RepaymentForm} from '@/components/charis-credit-forms';
import {currentAccount} from '@/lib/auth/account';
import {supabaseServer} from '@/lib/supabase/server';
import {ngn,loanBalance,loanState} from '@/lib/charis-loan-display';
import {z} from 'zod';
export const dynamic='force-dynamic';
export default async function LoanDetails({params}:{params:Promise<{id:string}>}){
 const account=await currentAccount();if(!account)redirect('/login');
 if(!['loans.view','loans.manage','loans.repayments'].some(k=>account.permissions.includes(k)))redirect('/dashboard');
 const {id}=await params;if(!z.uuid().safeParse(id).success)notFound();
 const org=account.workspace.id,db=await supabaseServer();
 const {data:loan}=await db.from('charis_loans').select('id,organization_id,contact_id,loan_reference,principal,total_due,disbursed_on,due_on,status,notes').eq('organization_id',org).eq('id',id).maybeSingle();
 if(!loan)notFound();
 const [{data:payments,error},{data:person},{data:totals,error:balanceError}]=await Promise.all([
  db.from('charis_loan_repayments').select('id,amount,paid_on,receipt_reference,notes,created_at').eq('organization_id',org).eq('loan_id',id).order('paid_on',{ascending:false}).limit(500),
  db.from('contacts').select('first_name,last_name,email').eq('organization_id',org).eq('id',loan.contact_id).maybeSingle(),
  db.from('charis_loan_balances').select('amount_paid,outstanding').eq('organization_id',org).eq('loan_id',id).maybeSingle()
 ]);
 const paid=Number(totals?.amount_paid||0),balance=loanBalance(loan.total_due,paid);
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const status=loanState(loan.status,balance,loan.due_on,today);
 return <WorkspaceShell title={`Loan ${loan.loan_reference}`} subtitle="Loan details and repayment history" org={org} actions={<Link className="btn secondary" href="/dashboard/loans">Back to register</Link>}>
  {balanceError&&<p role="alert" className="feedback-error">Unable to calculate the loan balance. Do not post a repayment until this is resolved.</p>}
  <div className="audience-kpis"><div className="audience-kpi"><span>Principal</span><strong>{ngn(loan.principal)}</strong></div><div className="audience-kpi"><span>Contracted total due</span><strong>{ngn(loan.total_due)}</strong></div><div className="audience-kpi"><span>Recorded repayments</span><strong>{balanceError?'Unavailable':ngn(paid)}</strong></div><div className="audience-kpi"><span>Outstanding balance</span><strong>{balanceError?'Unavailable':ngn(balance)}</strong></div></div>
  <section className="panel"><h2>Account information</h2><p><strong>Customer:</strong> {[person?.first_name,person?.last_name].filter(Boolean).join(' ')||person?.email||'Authorised customer'}</p><p><strong>Disbursed:</strong> {loan.disbursed_on} · <strong>Final due date:</strong> {loan.due_on} · <strong>Status:</strong> {status}</p>{loan.notes&&<p className="muted">{loan.notes}</p>}</section>
  <section className="panel"><h2>Repayments</h2>{error&&<p role="alert" className="feedback-error">Repayment records could not be loaded.</p>}
   {!error&&<div className="table-scroll"><table className="admin-table"><thead><tr><th>Date</th><th>Receipt reference</th><th>Amount</th><th>Notes</th></tr></thead><tbody>{(payments||[]).map(p=><tr key={p.id}><td>{p.paid_on}</td><td>{p.receipt_reference}</td><td>{ngn(p.amount)}</td><td>{p.notes||'—'}</td></tr>)}</tbody></table></div>}
   {!payments?.length&&!error&&<p className="muted">No repayments recorded yet.</p>}
   {payments?.length===500&&<p className="notice">Only the latest 500 entries are shown. Contact Finance for the full repayment history before reconciliation.</p>}
  </section>
  {account.permissions.includes('loans.repayments')&&!balanceError&&status!=='Settled'&&<section className="panel"><h2>Post a received repayment</h2><p className="muted">Enter only payments confirmed in the bank’s core ledger. A unique receipt reference prevents duplicate posting.</p><RepaymentForm loanId={id}/></section>}
  {account.permissions.includes('credit_reminders.create')&&account.permissions.includes('loans.view')&&<section className="panel"><h2>Repayment reminder</h2><p>Prepare a courteous repayment reminder using an authorised loan balance. Messages require the configured review policy and remain held until delivery is separately authorised.</p><Link className="btn secondary" href={`/dashboard/credit-reminders?loan=${id}`}>Prepare repayment reminder</Link></section>}
  {account.permissions.includes('service_notices.create')&&<section className="panel"><h2>Customer account communication</h2><p>Prepare a customer-specific service notice for review. This does not send a message.</p><Link className="btn secondary" href={`/dashboard/communications/service?customer=${loan.contact_id}&loan=${id}`}>Prepare account notice</Link></section>}
 </WorkspaceShell>;
}
