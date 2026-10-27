import Link from 'next/link';
import {redirect} from 'next/navigation';
import {WorkspaceShell} from '@/components/workspace-shell';
import {LoanForm} from '@/components/charis-credit-forms';
import {currentAccount} from '@/lib/auth/account';
import {supabaseServer} from '@/lib/supabase/server';
import {loanBalance,loanState,ngn,type LoanRow} from '@/lib/charis-loan-display';
export const dynamic='force-dynamic';
export default async function LoanRegister({searchParams}:{searchParams:Promise<{q?:string;customer?:string;page?:string;status?:string}>}){
 const account=await currentAccount();if(!account)redirect('/login');
 const canRead=['loans.view','loans.manage','loans.repayments'].some(k=>account.permissions.includes(k));
 if(!canRead)redirect('/dashboard');
 const org=account.workspace.id,db=await supabaseServer();
 const params=await searchParams;
 const q=(params.q||'').trim().replace(/[^a-zA-Z0-9_/-]/g,'').slice(0,64);
 const customer=(params.customer||'').trim().replace(/[^a-zA-Z0-9 .@+-]/g,'').slice(0,70);
 const page=Math.max(1,Math.min(500,Number.parseInt(params.page||'1',10)||1));
 const status=['all','active','settled'].includes(params.status||'')?params.status||'all':'all';
 let query=db.from('charis_loans').select('id,contact_id,loan_reference,principal,total_due,disbursed_on,due_on,status,created_at',{count:'exact'})
  .eq('organization_id',org).order('created_at',{ascending:false}).range((page-1)*25,page*25-1);
 if(q)query=query.ilike('loan_reference',`%${q}%`);
 if(status!=='all')query=query.eq('status',status);
 // Customer picker and loan list are independent; fetch both in one round-trip window.
 const [{data:loans,error,count},{data:matchingCustomers}]=await Promise.all([
  query,
  (account.permissions.includes('loans.manage')&&account.permissions.includes('customers.view'))?(()=>{
   let c=db.from('contacts').select('id,first_name,last_name,email').eq('organization_id',org).is('archived_at',null).order('created_at',{ascending:false}).limit(40);
   if(customer)c=c.or(`first_name.ilike.%${customer}%,last_name.ilike.%${customer}%,email.ilike.%${customer}%`);
   return c;
  })():Promise.resolve({data:[]})
 ]);
 const rows=(loans||[]) as LoanRow[];
 const ids=rows.map(l=>l.id),contactIds=[...new Set(rows.map(l=>l.contact_id))];
 const [{data:payments,error:balanceError},{data:names}]=await Promise.all([
  ids.length?db.from('charis_loan_balances').select('loan_id,amount_paid,outstanding').eq('organization_id',org).in('loan_id',ids):Promise.resolve({data:[],error:null}),
  contactIds.length?db.from('contacts').select('id,first_name,last_name,email').eq('organization_id',org).in('id',contactIds):Promise.resolve({data:[]})
 ]);
 const paid=new Map<string,number>();for(const p of payments||[])paid.set(p.loan_id,Number(p.amount_paid));
 const lookup=new Map((names||[]).map(c=>[c.id,[c.first_name,c.last_name].filter(Boolean).join(' ')||c.email||'Customer']));
 const now=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const currentRows=rows.map(l=>{const balance=balanceError?NaN:loanBalance(l.total_due,paid.get(l.id)||0);return {loan:l,balance,displayStatus:loanState(l.status,balance,l.due_on,now)};});
 const overdue=currentRows.filter(l=>l.displayStatus==='Overdue').length;
 const totalOutstanding=currentRows.reduce((sum,l)=>sum+l.balance,0);
 const customerOptions=(matchingCustomers||[]).map(c=>({id:c.id,name:[c.first_name,c.last_name].filter(Boolean).join(' ')||c.email||'Customer'}));
 const queryUrl=(next:number)=>`/dashboard/loans?${new URLSearchParams({q,status,customer,page:String(next)})}`;
 return <WorkspaceShell title="Loan portfolio" org={org} subtitle="Monitor assigned loan accounts, balances, repayments and overdue positions.">
  <div className="workspace-links">
   {account.permissions.includes("loans.manage")&&<Link href="/dashboard/loans/import">Review monthly loan file</Link>}
   {account.permissions.includes('credit_reminders.view')&&<Link href="/dashboard/credit-reminders">Repayment reminders</Link>}
   {account.permissions.includes('credit_followups.view')&&<Link href="/dashboard/credit-followups">Follow-up assignments</Link>}
  </div>
  <section className="panel"><div className="notice"><strong>Balance verification required.</strong> This operational loan register is not a live core-banking statement. Verify each balance and due date against authorised bank records before sending a reminder.</div></section>
  <div className="audience-kpis"><div className="audience-kpi"><span>Loans on this page</span><strong>{rows.length}</strong></div><div className="audience-kpi"><span>Overdue on this page</span><strong>{balanceError?'—':overdue}</strong></div><div className="audience-kpi"><span>Outstanding on this page</span><strong>{balanceError?'Unavailable':ngn(totalOutstanding)}</strong></div><div className="audience-kpi"><span>Records matching filters</span><strong>{count||0}</strong></div></div>
  <section className="panel"><h2>Find loan accounts</h2><form className="audience-search" method="get"><label>Loan reference<input name="q" defaultValue={q} placeholder="Search reference"/></label><label>Account status<select name="status" defaultValue={status}><option value="all">All</option><option value="active">Open</option><option value="settled">Settled</option></select></label><button className="btn secondary" type="submit">Search loans</button></form></section>
  {balanceError&&<p role="alert" className="feedback-error">Loan balances cannot be calculated. Contact the administrator before relying on this register.</p>}
  <section className="panel"><h2>Credit accounts</h2>{error&&<p role="alert" className="feedback-error">The loan register is unavailable. Ask an administrator to confirm the database upgrade.</p>}
   {!error&&<div className="table-scroll"><table className="admin-table"><thead><tr><th>Reference</th><th>Customer</th><th>Amount due</th><th>Paid</th><th>Balance</th><th>Due date</th><th>Status</th><th>Details</th></tr></thead><tbody>{currentRows.map(({loan,balance,displayStatus})=><tr key={loan.id}><td><strong>{loan.loan_reference}</strong></td><td>{lookup.get(loan.contact_id)||'Authorised customer'}</td><td>{ngn(loan.total_due)}</td><td>{balanceError?'—':ngn(paid.get(loan.id)||0)}</td><td>{balanceError?'—':ngn(balance)}</td><td>{loan.due_on}</td><td><span className="status-chip">{balanceError?'Unavailable':displayStatus}</span></td><td><Link href={`/dashboard/loans/${loan.id}`}>Open</Link></td></tr>)}</tbody></table></div>}
   {!rows.length&&!error&&<p className="muted">No loan accounts match this view.</p>}
   <div className="actions"><span>Page {page}</span>{page>1&&<Link className="btn secondary" href={queryUrl(page-1)}>Previous</Link>}{page*25<(count||0)&&<Link className="btn secondary" href={queryUrl(page+1)}>Next</Link>}</div>
  </section>
  {account.permissions.includes('loans.manage')&&account.permissions.includes('customers.view')&&<section className="panel"><h2>Register a loan account</h2>
   <p className="muted">Select an existing authorised customer. The loan reference must match an approved banking record.</p>
   <form method="get" className="audience-search"><label>Find an existing customer<input name="customer" defaultValue={customer} placeholder="Name or email"/></label><button type="submit" className="btn secondary">Find customer</button></form>
   <LoanForm customers={customerOptions}/>
  </section>}
 </WorkspaceShell>;
}
