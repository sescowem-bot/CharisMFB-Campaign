import Link from 'next/link';
import {redirect} from 'next/navigation';
import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import {LoanDispatchForm} from '@/components/charis-loan-dispatch-form';
import {WorkspaceShell} from '@/components/workspace-shell';
import {CreditReminderComposer,CreditReminderAction,type SelectableLoan} from '@/components/charis-credit-reminder-forms';
import {currentAccount} from '@/lib/auth/account';
import {supabaseServer} from '@/lib/supabase/server';
export const dynamic='force-dynamic';
type Batch={id:string;channel:string;subject:string;status:string;created_by:string;submitted_by:string|null;reviewed_by:string|null;review_note:string;updated_at:string};
export default async function CreditReminderCentre({searchParams}:{searchParams:Promise<{q?:string;status?:string;loan?:string}>}){
 const account=await currentAccount();if(!account)redirect('/login');
 const has=(key:string)=>account.permissions.includes(key);
 if(!['credit_reminders.view','credit_reminders.create','credit_reminders.approve','credit_reminders.queue','credit_reminders.settings','credit_reminders.dispatch'].some(has))redirect('/dashboard');
 const db=await supabaseServer(),org=account.workspace.id,sp=await searchParams;
 const q=(sp.q||'').replace(/[^\w /-]/g,'').trim().slice(0,64);
 const filter=['all','active','overdue','due_soon'].includes(sp.status||'')?sp.status||'all':'all';
 const canCompose=has('credit_reminders.create')&&has('credit_reminders.view')&&has('loans.view')&&has('customers.view');
 const canView=has('credit_reminders.view');
 const mayDispatch=has('credit_reminders.dispatch')&&has('credit_reminders.queue');
 const sendingEnabled=process.env.CHARIS_LOAN_EMAIL_DELIVERY_ENABLED==='true'&&process.env.CHARIS_LOAN_EMAIL_POLICY_APPROVED==='true';
 const {data:policy}=await db.from('charis_credit_reminder_policy').select('approval_mode,daily_recipient_limit').eq('organization_id',org).maybeSingle();
 const [{data:loanRows,error:loanError},{data:batchRows,error:batchError}]=await Promise.all([
  canCompose?(()=>{let query=db.from('charis_loans').select('id,contact_id,loan_reference,total_due,due_on,status').eq('organization_id',org).eq('status','active').order('created_at',{ascending:false}).limit(75);
   if(q)query=query.ilike('loan_reference',`%${q}%`);
   return query;})():Promise.resolve({data:[],error:null}),
  canView?db.from('charis_credit_reminder_batches').select('id,channel,subject,status,created_by,submitted_by,reviewed_by,review_note,updated_at').eq('organization_id',org).order('updated_at',{ascending:false}).limit(40):Promise.resolve({data:[],error:null})
 ]);
 const requestedLoan=z.uuid().safeParse(sp.loan);
 let loans=loanRows||[];
 if(canCompose&&requestedLoan.success&&!loans.some(l=>l.id===requestedLoan.data)){
  const {data:single}=await db.from('charis_loans').select('id,contact_id,loan_reference,total_due,due_on,status').eq('organization_id',org).eq('id',requestedLoan.data).eq('status','active').maybeSingle();
  if(single)loans=[single,...loans].slice(0,75);
 }
 const ids=loans.map(x=>x.id),contacts=[...new Set(loans.map(x=>x.contact_id))];
 const [{data:balances,error:balanceError},{data:people},{data:items}]=await Promise.all([
  ids.length?db.from('charis_loan_balances').select('loan_id,outstanding').eq('organization_id',org).in('loan_id',ids):Promise.resolve({data:[],error:null}),
  contacts.length?db.from('contacts').select('id,first_name,last_name,email,phone').eq('organization_id',org).is('archived_at',null).in('id',contacts):Promise.resolve({data:[]}),
  canView&&batchRows?.length?db.from('charis_credit_reminder_items').select('id,batch_id,loan_reference,recipient_message').eq('organization_id',org).in('batch_id',batchRows.map(b=>b.id)).limit(200):Promise.resolve({data:[]})
 ]);
 const balanceByLoan=new Map((balances||[]).map(x=>[x.loan_id,Number(x.outstanding)]));
 const contactById=new Map((people||[]).map(c=>[c.id,c]));
 const now=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
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
 // Read-only receipt status: SQL 043 is installed before the sending controls are activated.
 const {data:heldRows,error:heldError}=canView&&batchRows?.length
  ?await db.from('charis_credit_delivery_holds').select('id,batch_id,item_id,channel').eq('organization_id',org).in('batch_id',batchRows.map(b=>b.id)).limit(250)
  :{data:[],error:null};
 const {data:dispatchRows,error:dispatchError}=canView&&heldRows?.length
  ?await db.from('charis_credit_email_dispatches').select('id,hold_id,status,provider_message_id,requested_at').eq('organization_id',org).in('hold_id',heldRows.map(h=>h.id)).limit(250)
  :{data:[],error:null};
 const heldByItem=new Map((heldRows||[]).map(h=>[h.item_id,h]));
 const dispatchByHold=new Map((dispatchRows||[]).map(d=>[d.hold_id,d]));
 const countByBatch=new Map<string,number>();for(const i of items||[])countByBatch.set(i.batch_id,(countByBatch.get(i.batch_id)||0)+1);
 const batches=(batchRows||[]) as Batch[];
 const direct=policy?.approval_mode==='authorised_direct'&&has('credit_reminders.direct_approve');
 return <WorkspaceShell title="Loan reminders" subtitle="Customer repayment messages — prepare, approve, and deliver through an authorised bank service provider." org={org} actions={has('credit_reminders.settings')?<Link href="/dashboard/credit-reminders/settings" className="btn secondary">Approval settings</Link>:undefined}>
  <section className="charis-loan-hero"><div><h2>Clear, respectful repayment communication</h2><p>Prepare customer loan reminders using reconciled balances. Every message needs bank approval and a fresh account check. Staff tasks and alerts live in their own workspace.</p></div><div className="charis-loan-flag">{sendingEnabled?'Authorised service email enabled':'Customer email delivery locked until authorised'}</div></section>
  <section className="panel"><div className="notice"><strong>Loan balances must match the bank core ledger.</strong> This register is maintained internally, not automatically reconciled with BankOne. Email dispatch requires explicit bank/provider approval, a verified Brevo service sender and individual confirmation. SMS reminders remain held until an authorised SMS service integration is complete.</div></section>
  <div className="audience-kpis"><div className="audience-kpi"><span>Loans available in this view</span><strong>{filteredLoans.length}</strong></div><div className="audience-kpi"><span>Reminder batches shown</span><strong>{batches.length}</strong></div><div className="audience-kpi"><span>Review mode</span><strong style={{fontSize:'1rem'}}>{policy?.approval_mode==='authorised_direct'?'Delegated direct':'Independent'}</strong></div><div className="audience-kpi"><span>Daily held limit</span><strong>{policy?.daily_recipient_limit||'—'}</strong></div></div>
  {canCompose&&<section className="panel"><h2>Prepare a repayment reminder</h2><p className="muted">Select one customer, several customers, or all eligible loans displayed on this page. Each message uses an individual balance snapshot. The internal loan register is not a core banking integration.</p>
   <form className="audience-search" method="get"><label>Loan reference<input name="q" defaultValue={q} placeholder="Find an authorised loan"/></label><label>Loan due status<select name="status" defaultValue={filter}><option value="all">All open loans</option><option value="overdue">Overdue</option><option value="due_soon">Due within 7 days</option></select></label><button className="btn secondary">Find loans</button></form>
   {loanError||balanceError?<p role="alert" className="feedback-error">Loan balance data is unavailable. Reminder preparation is disabled until the register can be verified.</p>:<CreditReminderComposer loans={filteredLoans} initialLoan={z.uuid().safeParse(sp.loan).success?sp.loan:undefined} initialKey={randomUUID()}/>}
  </section>}
  {canView&&<section className="panel"><h2>Customer reminder batches</h2>
   {heldError&&<p role="alert" className="feedback-error">Held reminder records could not be loaded.</p>}
   {dispatchError&&<p role="alert" className="feedback-error">Delivery outcomes are unavailable. Check that SQL Migration 043 is installed before enabling live sending.</p>}{batchError&&<p role="alert" className="feedback-error">Reminder history could not be loaded. Verify Migration 032.</p>}
   {batches.map(b=>{
    const self=b.created_by===account.id||b.submitted_by===account.id;
    const canReview=has('credit_reminders.approve')&&b.status==='submitted'&&(!self||direct);
    const anySubmitted=(heldRows||[]).some(h=>h.batch_id===b.id&&dispatchByHold.get(h.id)?.status==='accepted');
    return <div key={b.id} className="charis-loan-batch"><div className="charis-loan-batch-header"><div><h3>{b.subject}</h3><p className="muted">{b.channel.toUpperCase()} · {countByBatch.get(b.id)||0} visible recipient(s) · {new Date(b.updated_at).toLocaleString('en-NG',{timeZone:'Africa/Lagos'})}</p></div><span className="status-chip">{b.status==='held'?(anySubmitted?'Provider submissions recorded':'Approved and held'):b.status.replaceAll('_',' ')}</span></div>
     {b.review_note&&<p className="muted">Review note: {b.review_note}</p>}
     {b.status==='held'&&<p className="notice">{b.channel==='sms'?'SMS delivery requires a separately approved bank provider; messages remain held.':'Service emails can be submitted one at a time using a verified Brevo sender. Provider acceptance is not proof of delivery.'}</p>}
     <div className="actions" style={{alignItems:'flex-start',flexWrap:'wrap'}}>
      {has('credit_reminders.create')&&b.created_by===account.id&&['draft','rejected'].includes(b.status)&&<CreditReminderAction id={b.id} decision="submit"/>}
      {canReview&&<><CreditReminderAction id={b.id} decision="approve"/><CreditReminderAction id={b.id} decision="reject"/></>}
      {has('credit_reminders.queue')&&b.status==='approved'&&<CreditReminderAction id={b.id} decision="hold"/>}
      {has('credit_reminders.create')&&b.created_by===account.id&&['draft','rejected','submitted'].includes(b.status)&&<CreditReminderAction id={b.id} decision="cancel"/>}
     </div>
     <details open={b.status==='held'}><summary>Customer messages and delivery status</summary>{(items||[]).filter(i=>i.batch_id===b.id).map(i=>{
      const hold=heldByItem.get(i.id);const dispatch=hold?dispatchByHold.get(hold.id):undefined;
      return <div key={i.id} className="charis-loan-dispatch"><strong>{i.loan_reference}</strong>
       <p className="muted">{dispatch?`Brevo: ${dispatch.status.replaceAll('_',' ')}${dispatch.provider_message_id?' · Provider reference recorded':''}`:hold?'Approved and held — not yet sent':'Draft or review — not sent'}</p>
       <p style={{whiteSpace:'pre-wrap'}}>{i.recipient_message}</p>
       {hold&&b.channel==='email'&&mayDispatch&&!dispatch&&<LoanDispatchForm holdId={hold.id} enabled={sendingEnabled}/>}
       {dispatch?.status==='uncertain'&&<p role="alert" className="feedback-error">Outcome uncertain. Do not send again until manually reconciled with Brevo.</p>}
      </div>;
     })}</details>
    </div>;
   })}
   {!batches.length&&!batchError&&<p className="muted">No credit reminder batches yet.</p>}
  </section>}
 </WorkspaceShell>;
}
