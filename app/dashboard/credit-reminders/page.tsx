import Link from 'next/link';
import {redirect} from 'next/navigation';
import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import {WorkspaceShell} from '@/components/workspace-shell';
import {CreditReminderComposer,type SelectableLoan} from '@/components/charis-credit-reminder-forms';
import {CreditAutoScan,CreditAutoDismiss} from '@/components/credit-auto-actions';
import {currentAccount} from '@/lib/auth/account';
import {supabaseServer} from '@/lib/supabase/server';
export const dynamic='force-dynamic';
type Batch={id:string;channel:string;subject:string;status:string;created_by:string;submitted_by:string|null;reviewed_by:string|null;review_note:string;updated_at:string};
export default async function CreditReminderCentre({searchParams}:{searchParams:Promise<{q?:string;status?:string;loan?:string;candidate?:string;history_page?:string}>}){
 const account=await currentAccount();if(!account)redirect('/login');
 const has=(key:string)=>account.permissions.includes(key);
 if(!['credit_reminders.view','credit_reminders.create','credit_reminders.approve','credit_reminders.queue','credit_reminders.settings','credit_reminders.dispatch'].some(has))redirect('/dashboard');
 const db=await supabaseServer(),org=account.workspace.id,sp=await searchParams;
 const q=(sp.q||'').replace(/[^\w /-]/g,'').trim().slice(0,64);
 const filter=['all','active','overdue','due_soon'].includes(sp.status||'')?sp.status||'all':'all';
 const historyPage=Math.min(1000,Math.max(1,Number.parseInt(sp.history_page||'1',10)||1));
 const historySize=12;
 const canCompose=has('credit_reminders.create')&&has('credit_reminders.view')&&has('loans.view')&&has('customers.view');
 const canView=has('credit_reminders.view');
 const sendingEnabled=process.env.CHARIS_LOAN_EMAIL_DELIVERY_ENABLED==='true'&&process.env.CHARIS_LOAN_EMAIL_POLICY_APPROVED==='true';
 // Fetch policy, active loans and recent batches concurrently.
 const [{data:policy},{data:loanRows,error:loanError},{data:batchRows,error:batchError,count:batchCount}]=await Promise.all([
  db.from('charis_credit_reminder_policy').select('approval_mode,daily_recipient_limit').eq('organization_id',org).maybeSingle(),
  canCompose?(()=>{let query=db.from('charis_loans').select('id,contact_id,loan_reference,total_due,due_on,status').eq('organization_id',org).eq('status','active').order('created_at',{ascending:false}).limit(75);
   if(q)query=query.ilike('loan_reference',`%${q}%`);
   return query;})():Promise.resolve({data:[],error:null}),
  canView?db.from('charis_credit_reminder_batches').select('id,channel,subject,status,created_by,submitted_by,reviewed_by,review_note,updated_at',{count:'exact'}).eq('organization_id',org).order('updated_at',{ascending:false}).range((historyPage-1)*historySize,historyPage*historySize-1):Promise.resolve({data:[],error:null,count:0})
 ]);
 const requestedLoan=z.uuid().safeParse(sp.loan);
 const candidateId=z.uuid().safeParse(sp.candidate);
 const {data:dueCandidates,error:dueError}=canView?await db.from('charis_credit_auto_candidates_056')
 .select('id,loan_id,contact_id,due_on,offset_days,channel,scheduled_for')
 .eq('organization_id',org).eq('status','pending').order('scheduled_for',{ascending:false}).limit(35):{data:[],error:null};
 const candidateLoanIds=[...new Set((dueCandidates||[]).map(c=>c.loan_id))];
 const [{data:dueLoanRows,error:dueLoansError},{data:duePeople,error:duePeopleError},{data:dueBalances,error:dueBalancesError}]=await Promise.all([
   candidateLoanIds.length?db.from('charis_loans').select('id,loan_reference,status,due_on,contact_id').eq('organization_id',org).in('id',candidateLoanIds):Promise.resolve({data:[],error:null}),
   (dueCandidates||[]).length?db.from('contacts').select('id,first_name,last_name').eq('organization_id',org).in('id',[...new Set((dueCandidates||[]).map(c=>c.contact_id))]):Promise.resolve({data:[],error:null}),
   candidateLoanIds.length?db.from('charis_loan_balances').select('loan_id,outstanding').eq('organization_id',org).in('loan_id',candidateLoanIds):Promise.resolve({data:[],error:null})
 ]);
 const dueDataError=Boolean(dueError||dueLoansError||duePeopleError||dueBalancesError);
 const dueLoans=new Map((dueLoanRows||[]).map(l=>[l.id,l]));
 const dueNames=new Map((duePeople||[]).map(c=>[c.id,[c.first_name,c.last_name].filter(Boolean).join(' ')||'Customer']));
 const dueAmounts=new Map((dueBalances||[]).map(v=>[v.loan_id,Number(v.outstanding)]));
 const visibleDue=(dueCandidates||[]).filter(c=>dueLoans.get(c.loan_id)?.status==='active'&&dueLoans.get(c.loan_id)?.due_on===c.due_on&&dueNames.has(c.contact_id)&&Number(dueAmounts.get(c.loan_id))>0);
 const selectedDue=candidateId.success?visibleDue.find(c=>c.id===candidateId.data&&requestedLoan.success&&c.loan_id===requestedLoan.data):undefined;
 let loans=loanRows||[];
 if(canCompose&&requestedLoan.success&&!loans.some(l=>l.id===requestedLoan.data)){
  const {data:single}=await db.from('charis_loans').select('id,contact_id,loan_reference,total_due,due_on,status').eq('organization_id',org).eq('id',requestedLoan.data).eq('status','active').maybeSingle();
  if(single)loans=[single,...loans].slice(0,75);
 }
 const ids=loans.map(x=>x.id),contacts=[...new Set(loans.map(x=>x.contact_id))];
 const [{data:balances,error:balanceError},{data:people,error:peopleError}]=await Promise.all([
  ids.length?db.from('charis_loan_balances').select('loan_id,outstanding').eq('organization_id',org).in('loan_id',ids):Promise.resolve({data:[],error:null}),
  contacts.length?db.from('contacts').select('id,first_name,last_name,email,phone').eq('organization_id',org).is('archived_at',null).in('id',contacts):Promise.resolve({data:[],error:null})
 ]);
 const balanceByLoan=new Map((balances||[]).map(x=>[x.loan_id,Number(x.outstanding)]));
 const contactById=new Map((people||[]).map(c=>[c.id,c]));
 const dateParts=new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const dateValue=(part:'year'|'month'|'day')=>dateParts.find(p=>p.type===part)?.value||'';
 const now=`${dateValue('year')}-${dateValue('month')}-${dateValue('day')}`;
 const soon=new Date(`${now}T12:00:00Z`);soon.setUTCDate(soon.getUTCDate()+7);const inWeek=soon.toISOString().slice(0,10);
 const filteredLoans:SelectableLoan[]=loans.filter(l=>{
   const b=balanceByLoan.get(l.id),p=contactById.get(l.contact_id);
   return typeof b==='number'&&Number.isFinite(b)&&b>0&&!!p&&
    (requestedLoan.success&&l.id===requestedLoan.data||filter==='all'||filter==='active'||(filter==='overdue'&&l.due_on<now)||(filter==='due_soon'&&l.due_on>=now&&l.due_on<=inWeek));
  }).slice(0,50).map(l=>{
  const person=contactById.get(l.contact_id)!;
  const fullName=[person.first_name,person.last_name].filter(Boolean).join(' ')||'Authorised customer';
  return {id:l.id,customerId:l.contact_id,reference:l.loan_reference,customer:fullName,first_name:person.first_name||'Customer',due:l.due_on,outstanding:balanceByLoan.get(l.id)!,email:!!person.email?.trim(),sms:!!person.phone?.trim()};
 });
 const batches=(batchRows||[]) as Batch[];
 return <WorkspaceShell title="Repayment reminders" subtitle="Review amounts due, prepare customer reminders and track delivery." org={org} actions={has('credit_reminders.settings')?<Link href="/dashboard/credit-reminders/settings" className="btn secondary">Reminder settings</Link>:undefined}>
  <section className="charis-loan-hero"><div><h2>Customer repayment reminders</h2><p>Identify payments due, select customer accounts, review each reminder and confirm sending.</p></div><div className="charis-loan-flag">{sendingEnabled?'Customer email available':'Customer email not enabled'}</div></section>
  <section className="panel"><p className="muted">Confirm repayment balances against the core banking ledger before creating a reminder. This register is not automatically reconciled.</p></section>
  <div className="audience-kpis"><div className="audience-kpi"><span>Loans available in this view</span><strong>{filteredLoans.length}</strong></div><div className="audience-kpi"><span>Reminder batches shown</span><strong>{batches.length}</strong></div><div className="audience-kpi"><span>Sending approval</span><strong style={{fontSize:'1rem'}}>{policy?.approval_mode==='authorised_direct'?'Delegated direct':'Independent'}</strong></div><div className="audience-kpi"><span>Daily sending limit</span><strong>{policy?.daily_recipient_limit||'—'}</strong></div></div>
  {canView&&<section className="panel"><div className="charis-loan-batch-header"><div><h2>Due for review</h2><p className="muted">Review upcoming and overdue repayments. Verify loan details before contacting customers.</p></div>{has('credit_reminders.settings')&&<CreditAutoScan/>}</div>
   {dueDataError&&<p role="alert" className="feedback-error">Due reminders are temporarily unavailable. Please try again or contact support.</p>}
   {!dueDataError&&!visibleDue.length&&<p className="muted">No due reminders waiting.</p>}
   {!dueDataError&&<div className="table-scroll"><table className="admin-table"><thead><tr><th>Customer</th><th>Loan</th><th>Timing</th><th>Channel</th><th>Action</th></tr></thead><tbody>{visibleDue.map(suggestion=>{
    const loan=dueLoans.get(suggestion.loan_id)!;return <tr key={suggestion.id}><td>{dueNames.get(suggestion.contact_id)}</td><td>{loan.loan_reference}</td><td>{suggestion.offset_days>0?`${suggestion.offset_days} days before`:suggestion.offset_days===0?'Due today':`${-suggestion.offset_days} days overdue`}</td><td>{suggestion.channel.toUpperCase()}</td><td><div className="actions" style={{flexWrap:'wrap'}}>{canCompose&&<Link className="btn secondary" href={`/dashboard/credit-reminders?loan=${suggestion.loan_id}&candidate=${suggestion.id}`}>Create draft</Link>}{has('credit_reminders.create')&&<CreditAutoDismiss id={suggestion.id}/>}</div></td></tr>;
   })}</tbody></table></div>}
  </section>}
  {canCompose&&<section className="panel"><h2>Prepare a repayment reminder</h2><p className="muted">Select eligible customers and verify their outstanding balances.</p>
   <form className="audience-search" method="get"><label>Loan reference<input name="q" defaultValue={q} placeholder="Find an authorised loan"/></label><label>Loan due status<select name="status" defaultValue={filter}><option value="all">All open loans</option><option value="overdue">Overdue</option><option value="due_soon">Due within 7 days</option></select></label><button className="btn secondary">Find loans</button></form>
   {loanError||balanceError||peopleError?<p role="alert" className="feedback-error">Loan balance data is unavailable. Reminder preparation is disabled until the register can be verified.</p>:<CreditReminderComposer loans={filteredLoans} initialLoan={z.uuid().safeParse(sp.loan).success?sp.loan:undefined} initialKey={randomUUID()} initialChannel={selectedDue?.channel==='sms'?'sms':'email'} initialCandidate={selectedDue?.id}/>}
  </section>}
  {canView&&<section className="panel"><h2>Reminder history</h2>
   {batchError&&<p role="alert" className="feedback-error">Reminder history is temporarily unavailable.</p>}
   <div className="charis-loan-batch-list">{batches.map(b=><article key={b.id} className="charis-loan-batch">
    <div className="charis-loan-batch-header"><div><h3>{b.subject}</h3><p className="muted">{b.channel.toUpperCase()} · {new Date(b.updated_at).toLocaleString('en-NG',{timeZone:'Africa/Lagos'})}</p></div>
    <span className="status-chip">{b.status==='held'?'Delivery details available':b.status.replaceAll('_',' ')}</span></div>
    <Link className="btn secondary" href={`/dashboard/credit-reminders/${b.id}`}>View reminder</Link>
   </article>)}</div>
   {!batches.length&&!batchError&&<p className="muted">No reminders found.</p>}
   <nav aria-label="Reminder history pages" className="actions" style={{marginTop:18}}><span>Page {historyPage}{batchCount!==null&&batchCount!==undefined?` · ${batchCount} batches`:''}</span>
    {historyPage>1&&<Link className="btn secondary" href={`/dashboard/credit-reminders?${new URLSearchParams({history_page:String(historyPage-1),q,status:filter})}`}>Previous</Link>}
    {batchCount!==null&&batchCount!==undefined&&historyPage*historySize<batchCount&&<Link className="btn secondary" href={`/dashboard/credit-reminders?${new URLSearchParams({history_page:String(historyPage+1),q,status:filter})}`}>Next</Link>}</nav>
  </section>}

 </WorkspaceShell>;
}
