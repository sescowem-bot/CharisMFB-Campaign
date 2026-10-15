import Link from 'next/link';
import {randomUUID} from 'node:crypto';
import {redirect} from 'next/navigation';
import {WorkspaceShell} from '@/components/workspace-shell';
import {FollowupCreateForm,FollowupStatusForm} from '@/components/charis-followup-forms';
import {currentAccount} from '@/lib/auth/account';
import {supabaseServer} from '@/lib/supabase/server';
export const dynamic='force-dynamic';
type Task={id:string;loan_id:string;contact_id:string;assigned_to:string;created_by:string;due_at:string;priority:string;notes:string;status:string;updated_at:string};
export default async function CreditFollowups({searchParams}:{searchParams:Promise<{status?:string;q?:string}>}){
 const account=await currentAccount();if(!account)redirect('/login');
 const has=(permission:string)=>account.permissions.includes(permission);
 const canView=has('credit_followups.view')||has('credit_followups.manage');
 const canCreate=has('credit_followups.create')&&has('loans.view')&&(has('credit_followups.view')||has('credit_followups.manage'));
 if(!canView&&!canCreate)redirect('/dashboard');
 const db=await supabaseServer(),org=account.workspace.id,params=await searchParams;
 const status=['open','done','cancelled','all'].includes(params.status||'')?params.status||'open':'open';
 const q=(params.q||'').trim().replace(/[^A-Za-z0-9_/-]/g,'').slice(0,60);
 const taskPromise=canView?(()=>{let query=db.from('charis_credit_followups')
  .select('id,loan_id,contact_id,assigned_to,created_by,due_at,priority,notes,status,updated_at')
  .eq('organization_id',org).order('due_at',{ascending:true}).limit(100);
  if(status!=='all')query=query.eq('status',status);
  return query;})():Promise.resolve({data:[] as Task[],error:null});
 const loanPromise=canCreate?(()=>{let query=db.from('charis_loans')
  .select('id,contact_id,loan_reference,due_on').eq('organization_id',org).eq('status','active')
  .order('created_at',{ascending:false}).limit(75);
  if(q)query=query.ilike('loan_reference',`%${q}%`);
  return query;})():Promise.resolve({data:[],error:null});
 const [{data:tasks,error:taskError},{data:loans,error:loanError}]=await Promise.all([taskPromise,loanPromise]);
 const loanIds=[...new Set([...(tasks||[]).map(t=>t.loan_id),...(loans||[]).map(l=>l.id)])];
 const contactIds=[...new Set([...(tasks||[]).map(t=>t.contact_id),...(loans||[]).map(l=>l.contact_id)])];
 const [{data:loanNames},{data:customers},{data:team}]=await Promise.all([
  loanIds.length?db.from('charis_loans').select('id,loan_reference').eq('organization_id',org).in('id',loanIds):Promise.resolve({data:[]}),
  contactIds.length?db.from('contacts').select('id,first_name,last_name').eq('organization_id',org).in('id',contactIds):Promise.resolve({data:[]}),
  has('credit_followups.manage')?db.rpc('team_members',{p_org:org}):Promise.resolve({data:[]})
 ]);
 const refs=new Map((loanNames||[]).map(l=>[l.id,l.loan_reference]));
 const names=new Map((customers||[]).map(c=>[c.id,[c.first_name,c.last_name].filter(Boolean).join(' ')||'Customer']));
 const staff=new Map<string,string>([[account.id,'Me']]);
 for(const person of Array.isArray(team)?team:[])if(person&&typeof person.id==='string'&&person.id!==account.id)staff.set(person.id,String(person.email||'Bank staff'));
 const selectable=(loans||[]).filter(l=>names.has(l.contact_id)).map(l=>({id:l.id,reference:l.loan_reference,customer:names.get(l.contact_id)!,due_on:l.due_on}));
 const safeTasks=(tasks||[]) as Task[];
 const openOverdue=safeTasks.filter(t=>t.status==='open'&&new Date(t.due_at).getTime()<Date.now()).length;
 return <WorkspaceShell org={org} title="Credit follow-ups" subtitle="Assign, schedule and close internal loan follow-up tasks. No customer emails or SMS are sent here.">
  <div className="workspace-links"><Link href="/dashboard/loans">Loan register</Link><Link href="/dashboard/credit-reminders">Credit reminders</Link><Link href="/dashboard/notifications">My notifications</Link></div>
  <div className="audience-kpis"><div className="audience-kpi"><span>Tasks in this view</span><strong>{safeTasks.length}</strong></div><div className="audience-kpi"><span>Past due in this view</span><strong>{openOverdue}</strong></div></div>
  {canCreate&&<section className="panel"><form method="get" className="audience-search"><label>Find loan by reference<input name="q" defaultValue={q} placeholder="Loan reference"/></label><button className="btn secondary">Find loan</button></form>
   {loanError&&<p className="feedback-error" role="alert">Unable to load loans for follow-up.</p>}
   {!loanError&&<FollowupCreateForm loans={selectable} staff={[...staff].map(([id,label])=>({id,label}))} self={account.id} canAssign={has('credit_followups.manage')} initialKey={randomUUID()}/>}
   {!selectable.length&&!loanError&&<p className="muted">No active loans available in your permitted customer scope.</p>}
  </section>}
  {canView&&<section className="panel"><h2>Follow-up workload</h2>
   <div className="workspace-links">{(['open','done','cancelled','all'] as const).map(s=><Link key={s} href={`/dashboard/credit-followups?status=${s}`} className="btn secondary" aria-current={s===status?'page':undefined}>{s==='open'?'To do':s==='done'?'Completed':s==='cancelled'?'Cancelled':'All'}</Link>)}</div>
   {taskError&&<p role="alert" className="feedback-error">Follow-up list unavailable. Check Migration 033 and your access permissions.</p>}
   {!taskError&&!safeTasks.length&&<p className="muted">No follow-ups in this view.</p>}
   <div className="charis-reminder-list">{safeTasks.map(t=><div className="charis-reminder-row" key={t.id}>
    <div><div className="charis-reminder-meta"><span className={`charis-priority ${t.priority}`}>{t.priority} priority</span><span>{t.status}</span><span>{t.status==='open'&&new Date(t.due_at).getTime()<Date.now()?'Past due':'Scheduled'}</span></div>
     <h3>{refs.get(t.loan_id)||'Permitted loan'} · {names.get(t.contact_id)||'Customer'}</h3>
     {t.notes&&<p>{t.notes}</p>}<small>Due {new Date(t.due_at).toLocaleString('en-NG',{timeZone:'Africa/Lagos',dateStyle:'medium',timeStyle:'short'})} WAT</small>
     <p className="muted">Assigned to {staff.get(t.assigned_to)|| (t.assigned_to===account.id?'Me':'Bank officer')}</p></div>
    {(t.assigned_to===account.id||t.created_by===account.id||has('credit_followups.manage'))&&<FollowupStatusForm id={t.id} status={t.status}/>}</div>)}</div>
  </section>}
 </WorkspaceShell>;
}
