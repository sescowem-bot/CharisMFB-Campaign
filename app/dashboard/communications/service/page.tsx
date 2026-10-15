import Link from 'next/link';
import {redirect} from 'next/navigation';
import {WorkspaceShell} from '@/components/workspace-shell';
import {NoticeComposer,SubmitNotice,ReviewNotice,EditNotice} from '@/components/charis-service-notice-forms';
import {currentAccount} from '@/lib/auth/account';
import {supabaseServer} from '@/lib/supabase/server';
import {z} from 'zod';
export const dynamic='force-dynamic';
export default async function ServiceNoticeCentre({searchParams}:{searchParams:Promise<{customer?:string;loan?:string;q?:string}>}){
 const account=await currentAccount();if(!account)redirect('/login');
 const canView=account.permissions.includes('service_notices.view');
 const canCreate=account.permissions.includes('service_notices.create');
 const canApprove=account.permissions.includes('service_notices.approve');
 if(!canView&&!canCreate&&!canApprove)redirect('/dashboard');
 const org=account.workspace.id,db=await supabaseServer(),params=await searchParams;
 const customerId=z.uuid().safeParse(params.customer),loanId=z.uuid().safeParse(params.loan);
 const q=(params.q||'').trim().replace(/[^a-zA-Z0-9 .@+-]/g,'').slice(0,65);
 let contactQuery=db.from('contacts').select('id,first_name,last_name,email,phone').eq('organization_id',org).is('archived_at',null).order('created_at',{ascending:false}).limit(50);
 if(q)contactQuery=contactQuery.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
 const [{data:contacts},{data:loanCandidates},{data:notices,error}]=await Promise.all([
  canCreate?contactQuery:Promise.resolve({data:[]}),
  canCreate?db.from('charis_loans').select('id,contact_id,loan_reference').eq('organization_id',org).order('created_at',{ascending:false}).limit(100):Promise.resolve({data:[]}),
  canView?db.from('charis_service_notices').select('id,contact_id,channel,subject,message,status,created_by,submitted_by,review_note,updated_at').eq('organization_id',org).order('updated_at',{ascending:false}).limit(50):Promise.resolve({data:[],error:null})
 ]);
 let customerOptions=(contacts||[]).map(c=>({id:c.id,name:[c.first_name,c.last_name].filter(Boolean).join(' ')||c.email||'Customer',email:c.email,phone:c.phone}));
 if(customerId.success&&!customerOptions.some(c=>c.id===customerId.data)){
  const {data:c}=await db.from('contacts').select('id,first_name,last_name,email,phone').eq('organization_id',org).eq('id',customerId.data).maybeSingle();
  if(c)customerOptions=[{id:c.id,name:[c.first_name,c.last_name].filter(Boolean).join(' ')||c.email||'Customer',email:c.email,phone:c.phone},...customerOptions];
 }
 const noticeContacts=[...new Set((notices||[]).map(n=>n.contact_id))];
 const {data:noticeNames}=noticeContacts.length?await db.from('contacts').select('id,first_name,last_name,email').eq('organization_id',org).in('id',noticeContacts):{data:[]};
 const customers=new Map([...customerOptions.map(c=>[c.id,c.name] as const),...(noticeNames||[]).map(c=>[c.id,[c.first_name,c.last_name].filter(Boolean).join(' ')||c.email||'Customer'] as const)]);
 return <WorkspaceShell title="Account-service notices" subtitle="Prepare individual account notifications separately from marketing campaigns." org={org} actions={<Link href="/dashboard/communications" className="btn secondary">Back to communications</Link>}>
  <section className="panel"><div className="notice"><strong>Draft and review only.</strong> This workspace does not send email or SMS. Approval does not mean delivery. Bank-authorised service notices require a separately approved delivery workflow before customer sending can be enabled.</div></section>
  {canCreate&&<section className="panel"><h2>Prepare a customer notice</h2><p className="muted">Select only a customer you are authorised to access. This notice is not a promotional campaign.</p>
   <form method="get" className="audience-search"><label>Find customer<input name="q" defaultValue={q} placeholder="Name or email"/></label><button type="submit" className="btn secondary">Find customer</button></form>
   <NoticeComposer customers={customerOptions} loanOptions={loanCandidates||[]} prefillCustomer={customerId.success?customerId.data:undefined} prefillLoan={loanId.success?loanId.data:undefined}/>
  </section>}
  {canView&&<section className="panel"><h2>Recent notice drafts</h2>{error&&<p role="alert" className="feedback-error">Notice history could not be loaded. Confirm the database upgrade.</p>}
   {(notices||[]).map(n=><div key={n.id} className="charis-sms-campaign"><div className="workspace-heading"><div><h3>{n.subject}</h3><p className="muted">{n.channel.toUpperCase()} · {customers.get(n.contact_id)||'Authorised customer'} · {new Date(n.updated_at).toLocaleString('en-NG')}</p></div><span className="status-chip">{n.status.replaceAll('_',' ')}</span></div>
    <p style={{whiteSpace:'pre-wrap'}}>{n.message}</p>{n.review_note&&<p className="muted">Reviewer: {n.review_note}</p>}
    {canCreate&&account.id===n.created_by&&['draft','rejected'].includes(n.status)&&<><EditNotice notice={n}/><SubmitNotice id={n.id}/></>}
    {canApprove&&n.status==='submitted'&&n.created_by!==account.id&&n.submitted_by!==account.id&&<ReviewNotice id={n.id}/>}
   </div>)}
   {!notices?.length&&!error&&<p className="muted">No account notice drafts yet.</p>}
  </section>}
 </WorkspaceShell>;
}
